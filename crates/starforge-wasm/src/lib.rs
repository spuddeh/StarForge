use wasm_bindgen::prelude::*;
use serde::Serialize;
use std::collections::HashMap;

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// ── GFx / SWF magic byte handling ────────────────────────────────────────────

fn gfx_to_swf_bytes(bytes: &[u8]) -> (Vec<u8>, bool) {
    if bytes.len() < 3 { return (bytes.to_vec(), false); }
    match &bytes[0..3] {
        b"GFX" => { let mut o = bytes.to_vec(); o[0..3].copy_from_slice(b"FWS"); (o, true) }
        b"CFX" => { let mut o = bytes.to_vec(); o[0..3].copy_from_slice(b"CWS"); (o, true) }
        _ => (bytes.to_vec(), false),
    }
}

fn swf_to_gfx_bytes(bytes: Vec<u8>, was_gfx: bool) -> Vec<u8> {
    if !was_gfx || bytes.len() < 3 { return bytes; }
    let mut out = bytes;
    match &out[0..3] {
        b"FWS" => { out[0..3].copy_from_slice(b"GFX"); }
        b"CWS" => { out[0..3].copy_from_slice(b"CFX"); }
        _ => {}
    }
    out
}

// ── swf-emitter 0.14.0 workarounds ───────────────────────────────────────────

fn encode_swf_tag_record(tag_code: u16, body: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    if body.len() < 63 {
        out.extend_from_slice(&((tag_code << 6) | body.len() as u16).to_le_bytes());
    } else {
        out.extend_from_slice(&((tag_code << 6) | 63u16).to_le_bytes());
        out.extend_from_slice(&(body.len() as i32).to_le_bytes());
    }
    out.extend_from_slice(body);
    out
}

fn serialise_import_assets(tag: &swf_types::tags::ImportAssets) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(tag.url.as_bytes()); body.push(0);
    body.push(1); body.push(0);
    body.extend_from_slice(&(tag.assets.len() as u16).to_le_bytes());
    for asset in &tag.assets {
        body.extend_from_slice(&asset.id.to_le_bytes());
        body.extend_from_slice(asset.name.as_bytes()); body.push(0);
    }
    encode_swf_tag_record(71, &body)
}

fn patch_tags(tags: &mut Vec<swf_types::Tag>) {
    for tag in tags.iter_mut() {
        if let swf_types::Tag::DefineSprite(sprite) = tag {
            patch_tags(&mut sprite.tags);
        } else if let swf_types::Tag::ImportAssets(ia) = tag {
            let data = serialise_import_assets(ia);
            *tag = swf_types::Tag::Raw(swf_types::tags::Raw { data });
        } else if let swf_types::Tag::DefineDynamicText(text) = tag {
            if text.font_class.is_some() && text.font_size.is_none() {
                text.font_size = Some(0);
            }
        }
    }
}

// ── Display list ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct DisplayItem {
    uid: u32,
    depth: u16,
    level: u32,       // nesting depth (0 = root timeline)
    character_id: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    element_type: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    /// CSS hex colour string for shape fills e.g. "#ff0000ff"
    #[serde(skip_serializing_if = "Option::is_none")]
    fill_colour: Option<String>,
    /// Text content for dynamic text fields
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    /// CSS hex colour string for text e.g. "#ffffffff"
    #[serde(skip_serializing_if = "Option::is_none")]
    text_colour: Option<String>,
    /// True if this is a sprite with children expanded below it in the list
    is_container: bool,
    /// Path of depths to reach this PlaceObject, e.g. [5] or [2, 5]
    path: Vec<u16>,
}

#[derive(Serialize)]
struct Stage {
    width: f64,
    height: f64,
    items: Vec<DisplayItem>,
}

/// Information extracted from a character-defining tag
struct CharInfo {
    bounds: Option<(i64, i64, i64, i64)>,
    element_type: &'static str,
    fill_colour: Option<[u8; 4]>,
    text: Option<String>,
    text_colour: Option<[u8; 4]>,
    sprite_tags: Option<Vec<serde_json::Value>>,
}

fn rect_twips(v: &serde_json::Value) -> Option<(i64, i64, i64, i64)> {
    Some((v["x_min"].as_i64()?, v["y_min"].as_i64()?, v["x_max"].as_i64()?, v["y_max"].as_i64()?))
}

fn extract_colour(v: &serde_json::Value) -> Option<[u8; 4]> {
    Some([
        v["r"].as_u64()? as u8,
        v["g"].as_u64()? as u8,
        v["b"].as_u64()? as u8,
        v["a"].as_u64().unwrap_or(255) as u8,
    ])
}

fn colour_to_hex(c: [u8; 4]) -> String {
    format!("#{:02x}{:02x}{:02x}{:02x}", c[0], c[1], c[2], c[3])
}

/// Extract the first solid fill colour from a DefineShape tag
fn extract_fill_colour(tag: &serde_json::Value) -> Option<[u8; 4]> {
    let fills = tag["shape"]["initial_styles"]["fill"].as_array()?;
    for fill in fills {
        // Try adjacently-tagged serde enum: {"type":"Solid","Solid":{"color":{...}}}
        if let Some(c) = extract_colour(&fill["Solid"]["color"]) {
            return Some(c);
        }
        // Try internally-tagged serde enum (fields inlined): {"type":"Solid","color":{...}}
        if let Some(c) = extract_colour(&fill["color"]) {
            return Some(c);
        }
    }
    None
}

fn build_char_map(tags: &[serde_json::Value]) -> HashMap<u64, CharInfo> {
    let mut map = HashMap::new();
    for tag in tags {
        let id = match tag["id"].as_u64() { Some(id) => id, None => continue };
        let info = match tag["type"].as_str().unwrap_or("") {
            "DefineShape" => CharInfo {
                bounds: rect_twips(&tag["bounds"]),
                element_type: "shape",
                fill_colour: extract_fill_colour(tag),
                text: None,
                text_colour: None,
                sprite_tags: None,
            },
            "DefineDynamicText" => CharInfo {
                bounds: rect_twips(&tag["bounds"]),
                element_type: "text",
                fill_colour: None,
                text: tag["text"].as_str().map(String::from),
                text_colour: extract_colour(&tag["color"]),
                sprite_tags: None,
            },
            "DefineSprite" => CharInfo {
                bounds: None,
                element_type: "sprite",
                fill_colour: None,
                text: None,
                text_colour: None,
                sprite_tags: tag["tags"].as_array().map(|v| v.to_vec()),
            },
            "DefineButton" | "DefineButton2" => CharInfo {
                bounds: None,
                element_type: "button",
                fill_colour: None,
                text: None,
                text_colour: None,
                sprite_tags: None,
            },
            _ => continue,
        };
        map.insert(id, info);
    }
    map
}

/// Recursively collect display items, composing parent transforms.
/// Max recursion depth of 5 to prevent runaway on deeply nested files.
fn collect_items(
    display_tags: &[serde_json::Value],
    char_map: &HashMap<u64, CharInfo>,
    parent_tx: f64,
    parent_ty: f64,
    parent_sx: f64,
    parent_sy: f64,
    uid: &mut u32,
    recurse_depth: u32,
    parent_path: &[u16],
    items: &mut Vec<DisplayItem>,
) {
    for tag in display_tags {
        match tag["type"].as_str().unwrap_or("") {
            "ShowFrame" => break,
            "PlaceObject" => {}
            _ => continue,
        }
        // Skip updates (they reposition existing characters, not place new ones)
        if tag["is_update"].as_bool().unwrap_or(false) { continue; }

        let char_id = match tag["character_id"].as_u64() { Some(id) => id, None => continue };
        let depth = tag["depth"].as_u64().unwrap_or(0) as u16;
        let name = tag["name"].as_str().map(String::from);

        // Local matrix: translate in twips, scale as Sfixed16P16 (65536 = 1.0)
        let mat = &tag["matrix"];
        let local_tx = mat["translate_x"].as_i64().unwrap_or(0) as f64;
        let local_ty = mat["translate_y"].as_i64().unwrap_or(0) as f64;
        let local_sx = mat["scale_x"].as_i64().map(|v| v as f64 / 65536.0).unwrap_or(1.0);
        let local_sy = mat["scale_y"].as_i64().map(|v| v as f64 / 65536.0).unwrap_or(1.0);

        // Compose with parent transform
        let world_tx = parent_tx + parent_sx * local_tx;
        let world_ty = parent_ty + parent_sy * local_ty;
        let world_sx = parent_sx * local_sx;
        let world_sy = parent_sy * local_sy;

        let info = char_map.get(&char_id);
        let element_type = info.map(|i| i.element_type).unwrap_or("unknown");

        let (x, y, w, h) = match info.and_then(|i| i.bounds) {
            Some((x_min, y_min, x_max, y_max)) => {
                let x = (world_tx + x_min as f64 * world_sx) / 20.0;
                let y = (world_ty + y_min as f64 * world_sy) / 20.0;
                let w = ((x_max - x_min) as f64 * world_sx / 20.0).abs();
                let h = ((y_max - y_min) as f64 * world_sy / 20.0).abs();
                (x, y, w, h)
            }
            None => (world_tx / 20.0, world_ty / 20.0, 64.0, 32.0),
        };

        let fill_colour = info.and_then(|i| i.fill_colour).map(colour_to_hex);
        let text = info.and_then(|i| i.text.clone());
        let text_colour = info
            .and_then(|i| i.text_colour)
            .map(|c| colour_to_hex([c[0], c[1], c[2], 255]));

        let sprite_tags = info.and_then(|i| i.sprite_tags.as_deref());
        let has_children = sprite_tags.is_some() && recurse_depth < 5;

        let mut item_path = parent_path.to_vec();
        item_path.push(depth);

        let current_uid = *uid;
        *uid += 1;

        items.push(DisplayItem {
            uid: current_uid,
            depth,
            level: recurse_depth,
            character_id: char_id as u16,
            name,
            element_type: element_type.to_string(),
            x, y, width: w, height: h,
            fill_colour,
            text,
            text_colour,
            is_container: has_children,
            path: item_path.clone(),
        });

        // Recurse into sprite's own display list
        if let (Some(tags), true) = (sprite_tags, has_children) {
            collect_items(
                tags, char_map,
                world_tx, world_ty,
                world_sx, world_sy,
                uid, recurse_depth + 1,
                &item_path,
                items,
            );
        }
    }
}

// ── Public WASM API ───────────────────────────────────────────────────────────

/// Parse a GFx/SWF file from raw bytes. Returns the Movie as a JSON string.
#[wasm_bindgen]
pub fn parse_gfx(bytes: &[u8]) -> Result<String, JsValue> {
    let (swf_bytes, _) = gfx_to_swf_bytes(bytes);
    let movie = swf_parser::parse_swf(&swf_bytes)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse GFx file: {e:?}")))?;
    serde_json::to_string(&movie)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialise Movie to JSON: {e}")))
}

/// Serialise a Movie JSON string back to GFx/SWF bytes.
#[wasm_bindgen]
pub fn emit_gfx(movie_json: &str, was_gfx: bool) -> Result<Vec<u8>, JsValue> {
    let mut movie: swf_types::Movie = serde_json::from_str(movie_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialise Movie JSON: {e}")))?;
    patch_tags(&mut movie.tags);
    let swf_bytes = swf_emitter::emit_swf(&movie, swf_types::CompressionMethod::None)
        .map_err(|e| JsValue::from_str(&format!("Failed to emit GFx bytes: {e:?}")))?;
    Ok(swf_to_gfx_bytes(swf_bytes, was_gfx))
}

/// Build a display list from Movie JSON. Returns all elements recursively expanded,
/// with fill colours and text content included where available.
#[wasm_bindgen]
pub fn get_display_list(movie_json: &str) -> Result<String, JsValue> {
    let movie: serde_json::Value = serde_json::from_str(movie_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse Movie JSON: {e}")))?;

    let tags = movie["tags"].as_array()
        .ok_or_else(|| JsValue::from_str("Movie has no tags array"))?;

    // Stage size
    let fs = &movie["header"]["frame_size"];
    let stage_w = (fs["x_max"].as_i64().unwrap_or(25600) - fs["x_min"].as_i64().unwrap_or(0)) as f64 / 20.0;
    let stage_h = (fs["y_max"].as_i64().unwrap_or(14400) - fs["y_min"].as_i64().unwrap_or(0)) as f64 / 20.0;

    let char_map = build_char_map(tags);

    let mut items = Vec::new();
    let mut uid = 0u32;
    collect_items(tags, &char_map, 0.0, 0.0, 1.0, 1.0, &mut uid, 0, &[], &mut items);

    serde_json::to_string(&Stage { width: stage_w, height: stage_h, items })
        .map_err(|e| JsValue::from_str(&format!("Failed to serialise display list: {e}")))
}

// ── Editing functions ─────────────────────────────────────────────────────────

/// Navigate to a PlaceObject following `path` (list of depths) through the tag tree.
/// Modifies translate_x/translate_y in-place. Returns true if found.
fn apply_position(tags: &mut serde_json::Value, path: &[u16], x_twips: i64, y_twips: i64) -> bool {
    if path.is_empty() { return false; }
    let target = path[0];

    let arr = match tags.as_array_mut() { Some(a) => a, None => return false };

    if path.len() == 1 {
        for tag in arr.iter_mut() {
            if tag["type"].as_str() == Some("PlaceObject")
               && tag["depth"].as_u64() == Some(target as u64)
            {
                tag["matrix"]["translate_x"] = serde_json::json!(x_twips);
                tag["matrix"]["translate_y"] = serde_json::json!(y_twips);
                return true;
            }
        }
        return false;
    }

    // Find which sprite to descend into
    let char_id = arr.iter()
        .find(|t| t["type"].as_str() == Some("PlaceObject") && t["depth"].as_u64() == Some(target as u64))
        .and_then(|t| t["character_id"].as_u64());

    let char_id = match char_id { Some(id) => id, None => return false };

    for tag in arr.iter_mut() {
        if tag["type"].as_str() == Some("DefineSprite") && tag["id"].as_u64() == Some(char_id) {
            return apply_position(&mut tag["tags"], &path[1..], x_twips, y_twips);
        }
    }
    false
}

/// Update the position of a PlaceObject identified by its depth path.
/// path_json: JSON array of depths e.g. "[5]" or "[2, 5]".
/// x, y: new absolute position in pixels.
#[wasm_bindgen]
pub fn set_element_position(movie_json: &str, path_json: &str, x: f64, y: f64) -> Result<String, JsValue> {
    let mut movie: serde_json::Value = serde_json::from_str(movie_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse Movie JSON: {e}")))?;

    let path: Vec<u16> = serde_json::from_str(path_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse path: {e}")))?;

    let x_twips = (x * 20.0).round() as i64;
    let y_twips = (y * 20.0).round() as i64;

    apply_position(&mut movie["tags"], &path, x_twips, y_twips);

    serde_json::to_string(&movie)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialise Movie JSON: {e}")))
}

/// Update the text content of a DefineDynamicText by character ID.
/// Searches the full tag tree (including nested sprites).
#[wasm_bindgen]
pub fn set_element_text(movie_json: &str, character_id: u16, text: &str) -> Result<String, JsValue> {
    let mut movie: serde_json::Value = serde_json::from_str(movie_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse Movie JSON: {e}")))?;

    fn update_text(tags: &mut serde_json::Value, char_id: u16, text: &str) {
        if let Some(arr) = tags.as_array_mut() {
            for tag in arr.iter_mut() {
                if tag["type"].as_str() == Some("DefineDynamicText")
                   && tag["id"].as_u64() == Some(char_id as u64)
                {
                    tag["text"] = serde_json::json!(text);
                    return;
                }
                if tag["type"].as_str() == Some("DefineSprite") {
                    update_text(&mut tag["tags"], char_id, text);
                }
            }
        }
    }

    update_text(&mut movie["tags"], character_id, text);

    serde_json::to_string(&movie)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialise Movie JSON: {e}")))
}
