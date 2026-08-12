use std::path::PathBuf;
use std::process::Command;

fn shot_qa_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_shot-qa"))
}

fn tmp_path(name: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("shot-qa-test-{}-{name}", std::process::id()));
    p
}

fn encode_png(
    path: &PathBuf,
    width: u32,
    height: u32,
    pixel_fn: impl Fn(u32, u32) -> [u8; 4],
    dpi: Option<f64>,
) {
    let file = std::fs::File::create(path).unwrap();
    let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    if let Some(dpi) = dpi {
        let ppm = (dpi / 0.0254).round() as u32;
        encoder.set_pixel_dims(Some(png::PixelDimensions {
            xppu: ppm,
            yppu: ppm,
            unit: png::Unit::Meter,
        }));
    }
    let mut writer = encoder.write_header().unwrap();
    let mut data = vec![0u8; (width * height * 4) as usize];
    for y in 0..height {
        for x in 0..width {
            let off = ((y * width + x) * 4) as usize;
            data[off..off + 4].copy_from_slice(&pixel_fn(x, y));
        }
    }
    writer.write_image_data(&data).unwrap();
}

#[test]
fn png_info_reports_dimensions_and_dpi() {
    let path = tmp_path("info.png");
    encode_png(&path, 12, 8, |_, _| [1, 2, 3, 255], Some(192.0));
    let out = Command::new(shot_qa_bin())
        .arg("png-info")
        .arg(&path)
        .output()
        .unwrap();
    assert!(out.status.success());
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(json["width"], 12);
    assert_eq!(json["height"], 8);
    let dpi = json["dpi"][0].as_f64().unwrap();
    assert!((dpi - 192.0).abs() < 1.0, "expected ~192 dpi, got {dpi}");
    let _ = std::fs::remove_file(&path);
}

#[test]
fn hash_matches_sha256_of_file_bytes() {
    use sha2::{Digest, Sha256};
    let path = tmp_path("hash.png");
    encode_png(&path, 4, 4, |x, y| [x as u8, y as u8, 0, 255], None);
    let bytes = std::fs::read(&path).unwrap();
    let expected = hex::encode(Sha256::digest(&bytes));

    let out = Command::new(shot_qa_bin())
        .arg("hash")
        .arg(&path)
        .output()
        .unwrap();
    assert!(out.status.success());
    let got = String::from_utf8(out.stdout).unwrap().trim().to_string();
    assert_eq!(got, expected);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn band_sample_reads_correct_band_colors() {
    let path = tmp_path("bands.png");
    // 3 bands of height 10, each a distinct solid color.
    let colors: [[u8; 4]; 3] = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]];
    encode_png(&path, 4, 30, |_, y| colors[(y / 10) as usize], None);

    let out = Command::new(shot_qa_bin())
        .args([
            "band-sample",
            path.to_str().unwrap(),
            "--bands",
            "3",
            "--band-height",
            "10",
            "--x",
            "1",
            "--y-offset",
            "5",
        ])
        .output()
        .unwrap();
    assert!(out.status.success());
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    let bands = json.as_array().unwrap();
    assert_eq!(bands.len(), 3);
    for (i, band) in bands.iter().enumerate() {
        assert_eq!(band["r"], colors[i][0]);
        assert_eq!(band["g"], colors[i][1]);
        assert_eq!(band["b"], colors[i][2]);
    }
    let _ = std::fs::remove_file(&path);
}

#[test]
fn diff_identical_images_passes_with_zero_ratio() {
    let a = tmp_path("diff-a.png");
    let b = tmp_path("diff-b.png");
    encode_png(&a, 8, 8, |x, y| [x as u8, y as u8, 7, 255], None);
    encode_png(&b, 8, 8, |x, y| [x as u8, y as u8, 7, 255], None);

    let out = Command::new(shot_qa_bin())
        .args(["diff", a.to_str().unwrap(), b.to_str().unwrap()])
        .output()
        .unwrap();
    assert!(out.status.success());
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(json["diffRatio"], 0.0);
    assert_eq!(json["passed"], true);
    let _ = std::fs::remove_file(&a);
    let _ = std::fs::remove_file(&b);
}

#[test]
fn diff_different_images_fails_above_threshold() {
    let a = tmp_path("diff-c.png");
    let b = tmp_path("diff-d.png");
    encode_png(&a, 8, 8, |_, _| [0, 0, 0, 255], None);
    encode_png(&b, 8, 8, |_, _| [255, 255, 255, 255], None);

    let out = Command::new(shot_qa_bin())
        .args(["diff", a.to_str().unwrap(), b.to_str().unwrap()])
        .output()
        .unwrap();
    assert!(
        !out.status.success(),
        "expected failure exit code for a fully different image pair"
    );
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(json["diffRatio"], 1.0);
    assert_eq!(json["passed"], false);
    let _ = std::fs::remove_file(&a);
    let _ = std::fs::remove_file(&b);
}

#[test]
fn assert_absent_and_present_roundtrip() {
    let path = tmp_path("watermark.png");
    std::fs::write(
        &path,
        b"hello world, this is definitely not a watermark string",
    )
    .unwrap();

    let absent = Command::new(shot_qa_bin())
        .args([
            "assert-absent",
            path.to_str().unwrap(),
            "GoFullPageWatermark",
        ])
        .output()
        .unwrap();
    assert!(absent.status.success());

    let present = Command::new(shot_qa_bin())
        .args(["assert-present", path.to_str().unwrap(), "hello world"])
        .output()
        .unwrap();
    assert!(present.status.success());

    let should_fail = Command::new(shot_qa_bin())
        .args([
            "assert-present",
            path.to_str().unwrap(),
            "GoFullPageWatermark",
        ])
        .output()
        .unwrap();
    assert!(!should_fail.status.success());
    let _ = std::fs::remove_file(&path);
}

#[test]
fn pdf_info_reports_page_count_and_sizes() {
    let img1 = shot_core::encode::encode_png(
        &shot_core::stitch::Segment {
            width_dev: 400,
            height_dev: 200,
            rgba: vec![10u8; 400 * 200 * 4],
        },
        2.0,
    )
    .unwrap();
    let img2 = shot_core::encode::encode_png(
        &shot_core::stitch::Segment {
            width_dev: 400,
            height_dev: 300,
            rgba: vec![20u8; 400 * 300 * 4],
        },
        2.0,
    )
    .unwrap();
    let pdf_bytes = shot_core::pdf::build_pdf(&[img1, img2], 2.0).unwrap();

    let path = tmp_path("doc.pdf");
    std::fs::write(&path, &pdf_bytes).unwrap();

    let out = Command::new(shot_qa_bin())
        .arg("pdf-info")
        .arg(&path)
        .output()
        .unwrap();
    assert!(out.status.success());
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(json["pageCount"], 2);
    assert_eq!(json["pages"].as_array().unwrap().len(), 2);
    let _ = std::fs::remove_file(&path);
}
