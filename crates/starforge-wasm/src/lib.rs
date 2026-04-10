use wasm_bindgen::prelude::*;
use serde::Serialize;
use std::collections::HashMap;

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// ── GFx / SWF magic byte handling ────────────────────────────────────────────

fn gfx_to_swf_bytes(bytes: &[u8]) -> (Vec<u8>, bool) {
    if bytes.len() < 3 {
        return (bytes.to_vec(), false);
    }
    match &bytes[0..3] {
        b"GFX" => {
            let mut out = bytes.to_vec();
            out[0..3].copy_from_slice(b"FWS");
            (out, true)
        }
        b"CFX" => {
            let mut out = bytes.to_vec();
            out[0..3].copy_from_slice(b"CWS");
            (out, true)
        }
        _ => (bytes.to_vec(), false),
    }
}

fn swf_to_gfx_bytes(bytes: Vec<u8>, was_gfx: bool) -> Vec<u8> {
    if !was_gfx || bytes.len() < 3 {
        return bytes;
    }
    let mut out = bytes;
    match &out[0..3] {
        b"FWS" => { out[0..3].copy_from_slice(b"GFX"); }
        b"CWS" => { out[0..3].copy_from_slice(b"CFX"); }
        _ => {}
    }
    out
}

// ── ImportAssets / DefineDynamicText workarounds ──────────────────────────────

fn encode_swf_tag_record(tag_code: u16, body: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    if body.len() < 63 {
        let header = (tag_code << 6) | body.len() as u16;
        out.extend_from_slice(&header.to_le_bytes());
    } else {
        let header = (tag_code << 6) | 63u16;
        out.extend_from_slice(&header.to_le_bytes());
        out.extend_from_slice(&(body.len() as i32).to_le_bytes());
    }
    out.extend_from_slice(body);
    out
}

fn serialise_import_assets(tag: &swf_types::tags::ImportAssets) -> Vec<u8> {
    let mut body: Vec<u8> = Vec::new();
    body.extend_from_slice(tag.url.as_bytes());
    body.push(0u8);
    body.push(1u8);
    body.push(0u8);
    body.extend_from_slice(&(tag.assets.len() as u16).to_le_bytes());
    for asset in &tag.assets {
        body.extend_from_slice(&asset.id.to_le_bytes());
        body.extend_from_slice(asset.name.as_bytes());
        body.push(0u8);
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
    depth: u16,
    character_id: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    element_type: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Serialize)]
struct Stage {
    width: f64,
    height: f64,
    items: Vec<DisplayItem>,
}

/// Extract x_min/y_min/x_max/y_max from a serde_json::Value Rect
fn rect_twips(v: &serde_json::Value) -> Option<(i64, i64, i64, i64)> {
    Some((
        v["x_min"].as_i64()?,
        v["y_min"].as_i64()?,
        v["x_max"].as_i64()?,
        v["y_max"].as_i64()?,
    ))
}

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

/// Build a display list from a Movie JSON string.
///
/// Returns JSON: { width, height, items: [{ depth, character_id, name?, element_type, x, y, width, height }] }
/// All coordinates are in pixels (twips / 20). Only processes frame 0.
#[wasm_bindgen]
pub fn get_display_list(movie_json: &str) -> Result<String, JsValue> {
    let movie: serde_json::Value = serde_json::from_str(movie_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse Movie JSON: {e}")))?;

    let tags = movie["tags"].as_array()
        .ok_or_else(|| JsValue::from_str("Movie has no tags array"))?;

    // Stage size from header.frame_size (twips)
    let fs = &movie["header"]["frame_size"];
    let stage_w = (fs["x_max"].as_i64().unwrap_or(25600)
        - fs["x_min"].as_i64().unwrap_or(0)) as f64 / 20.0;
    let stage_h = (fs["y_max"].as_i64().unwrap_or(14400)
        - fs["y_min"].as_i64().unwrap_or(0)) as f64 / 20.0;

    // Character map: id -> (bounds_twips, element_type)
    let mut chars: HashMap<u64, (Option<(i64,i64,i64,i64)>, &'static str)> = HashMap::new();

    for tag in tags {
        let id = match tag["id"].as_u64() { Some(id) => id, None => continue };
        match tag["type"].as_str().unwrap_or("") {
            "DefineShape" => {
                chars.insert(id, (rect_twips(&tag["bounds"]), "shape"));
            }
            "DefineDynamicText" => {
                chars.insert(id, (rect_twips(&tag["bounds"]), "text"));
            }
            "DefineSprite" => {
                chars.insert(id, (None, "sprite"));
            }
            "DefineButton" | "DefineButton2" => {
                chars.insert(id, (None, "button"));
            }
            _ => {}
        }
    }

    // Walk the main timeline and collect PlaceObject tags (frame 0 only)
    let mut items: Vec<DisplayItem> = Vec::new();

    for tag in tags {
        match tag["type"].as_str().unwrap_or("") {
            "ShowFrame" => break,
            "PlaceObject" => {}
            _ => continue,
        }

        // Skip updates — these reposition existing characters, handled later
        if tag["is_update"].as_bool().unwrap_or(false) {
            continue;
        }

        let char_id = match tag["character_id"].as_u64() {
            Some(id) => id,
            None => continue,
        };

        let depth = tag["depth"].as_u64().unwrap_or(0) as u16;
        let name = tag["name"].as_str().map(String::from);

        // Matrix: translate in twips, scale as Sfixed16P16 (65536 = 1.0)
        let mat = &tag["matrix"];
        let tx = mat["translate_x"].as_i64().unwrap_or(0) as f64;
        let ty = mat["translate_y"].as_i64().unwrap_or(0) as f64;
        let sx = mat["scale_x"].as_i64().map(|v| v as f64 / 65536.0).unwrap_or(1.0);
        let sy = mat["scale_y"].as_i64().map(|v| v as f64 / 65536.0).unwrap_or(1.0);

        let (bounds, elem_type) = chars.get(&char_id)
            .map(|(b, t)| (*b, *t))
            .unwrap_or((None, "unknown"));

        let (x, y, w, h) = match bounds {
            Some((x_min, y_min, x_max, y_max)) => {
                let x = (tx + x_min as f64 * sx) / 20.0;
                let y = (ty + y_min as f64 * sy) / 20.0;
                let w = ((x_max - x_min) as f64 * sx / 20.0).abs();
                let h = ((y_max - y_min) as f64 * sy / 20.0).abs();
                (x, y, w, h)
            }
            None => (tx / 20.0, ty / 20.0, 64.0, 32.0),
        };

        items.push(DisplayItem {
            depth,
            character_id: char_id as u16,
            name,
            element_type: elem_type.to_string(),
            x, y, width: w, height: h,
        });
    }

    items.sort_by_key(|i| i.depth);

    serde_json::to_string(&Stage { width: stage_w, height: stage_h, items })
        .map_err(|e| JsValue::from_str(&format!("Failed to serialise display list: {e}")))
}
