use wasm_bindgen::prelude::*;

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

// ── ImportAssets workaround ───────────────────────────────────────────────────
//
// swf-emitter 0.14.0 (crates.io) has `unimplemented!()` for Tag::ImportAssets.
// We serialise it manually as a Raw tag (code 71, ImportAssets2) so the emitter
// writes it through unchanged. This matches what Scaleform GFx files use.

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

    // URL as null-terminated string
    body.extend_from_slice(tag.url.as_bytes());
    body.push(0u8);

    // 2 reserved bytes required by ImportAssets2 (tag 71)
    body.push(1u8);
    body.push(0u8);

    // Asset count (u16 LE)
    body.extend_from_slice(&(tag.assets.len() as u16).to_le_bytes());

    // Each asset: id (u16 LE) then name (null-terminated string)
    for asset in &tag.assets {
        body.extend_from_slice(&asset.id.to_le_bytes());
        body.extend_from_slice(asset.name.as_bytes());
        body.push(0u8);
    }

    encode_swf_tag_record(71, &body)
}

/// Walk all tags recursively, fixing two bugs in swf-emitter 0.14.0:
///
/// 1. ImportAssets — unimplemented!(), converted to Raw.
/// 2. DefineDynamicText — asserts font_class and font_size are both present;
///    Scaleform GFx files can have font_class without font_size, so we supply
///    a zero font_size to satisfy the assertion without changing layout.
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

// ── Public WASM API ───────────────────────────────────────────────────────────

/// Parse a GFx/SWF file from raw bytes. Returns the Movie as a JSON string.
/// Accepts both SWF (FWS/CWS) and Scaleform GFx (GFX/CFX) files.
#[wasm_bindgen]
pub fn parse_gfx(bytes: &[u8]) -> Result<String, JsValue> {
    let (swf_bytes, _) = gfx_to_swf_bytes(bytes);

    let movie = swf_parser::parse_swf(&swf_bytes)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse GFx file: {e:?}")))?;

    serde_json::to_string(&movie)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialise Movie to JSON: {e}")))
}

/// Serialise a Movie JSON string back to GFx/SWF bytes.
/// Pass `was_gfx: true` to restore GFx magic bytes in the output.
#[wasm_bindgen]
pub fn emit_gfx(movie_json: &str, was_gfx: bool) -> Result<Vec<u8>, JsValue> {
    let mut movie: swf_types::Movie = serde_json::from_str(movie_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to deserialise Movie JSON: {e}")))?;

    // Fix swf-emitter 0.14.0 bugs before emitting
    patch_tags(&mut movie.tags);

    let swf_bytes = swf_emitter::emit_swf(&movie, swf_types::CompressionMethod::None)
        .map_err(|e| JsValue::from_str(&format!("Failed to emit GFx bytes: {e:?}")))?;

    Ok(swf_to_gfx_bytes(swf_bytes, was_gfx))
}
