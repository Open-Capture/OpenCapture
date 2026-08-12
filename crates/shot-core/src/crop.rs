//! Selected-area capture: crop a decoded RGBA bitmap to a device-pixel
//! rectangle, clamping to the source bounds rather than erroring on a
//! selection that runs slightly past the edge (a drag gesture that ends a
//! pixel or two off the viewport is normal user behavior, not a bug).

use crate::error::StitchError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CropRect {
    pub x_dev: u32,
    pub y_dev: u32,
    pub width_dev: u32,
    pub height_dev: u32,
}

impl CropRect {
    /// Clamps this rect to fit within a `bounds_width x bounds_height`
    /// source image, shrinking (never shifting) the rect so it never reads
    /// out of bounds. Returns `None` if the clamped rect would be empty
    /// (e.g. the selection started entirely outside the source image).
    fn clamp_to(&self, bounds_width: u32, bounds_height: u32) -> Option<CropRect> {
        let x = self.x_dev.min(bounds_width);
        let y = self.y_dev.min(bounds_height);
        let width = self.width_dev.min(bounds_width.saturating_sub(x));
        let height = self.height_dev.min(bounds_height.saturating_sub(y));
        if width == 0 || height == 0 {
            return None;
        }
        Some(CropRect {
            x_dev: x,
            y_dev: y,
            width_dev: width,
            height_dev: height,
        })
    }
}

pub struct CroppedImage {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

pub fn crop_rgba(
    rgba: &[u8],
    width: u32,
    height: u32,
    rect: CropRect,
) -> Result<CroppedImage, StitchError> {
    let clamped = rect.clamp_to(width, height).ok_or_else(|| {
        StitchError::Encode("crop rectangle does not overlap the source image".into())
    })?;

    let row_bytes = width as usize * 4;
    let out_row_bytes = clamped.width_dev as usize * 4;
    let mut out = vec![0u8; out_row_bytes * clamped.height_dev as usize];

    for row in 0..clamped.height_dev {
        let src_row = clamped.y_dev + row;
        let src_off = src_row as usize * row_bytes + clamped.x_dev as usize * 4;
        let dst_off = row as usize * out_row_bytes;
        out[dst_off..dst_off + out_row_bytes]
            .copy_from_slice(&rgba[src_off..src_off + out_row_bytes]);
    }

    Ok(CroppedImage {
        width: clamped.width_dev,
        height: clamped.height_dev,
        rgba: out,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn row_indexed(width: u32, height: u32) -> Vec<u8> {
        let mut data = vec![0u8; (width * height * 4) as usize];
        for row in 0..height {
            for col in 0..width {
                let off = ((row * width + col) * 4) as usize;
                data[off..off + 4].copy_from_slice(&[(row % 256) as u8, (col % 256) as u8, 0, 255]);
            }
        }
        data
    }

    #[test]
    fn crop_extracts_exact_subregion() {
        let src = row_indexed(10, 10);
        let cropped = crop_rgba(
            &src,
            10,
            10,
            CropRect {
                x_dev: 2,
                y_dev: 3,
                width_dev: 4,
                height_dev: 5,
            },
        )
        .unwrap();
        assert_eq!(cropped.width, 4);
        assert_eq!(cropped.height, 5);
        // pixel (0,0) of the crop is source pixel (2,3) -> row=3, col=2
        assert_eq!(&cropped.rgba[0..4], &[3, 2, 0, 255]);
        // last pixel of the crop is source (5,7) -> row=7, col=5
        let last_off = (4 * 4 + 3) * 4;
        assert_eq!(&cropped.rgba[last_off..last_off + 4], &[7, 5, 0, 255]);
    }

    #[test]
    fn crop_clamps_rect_extending_past_bounds() {
        let src = row_indexed(10, 10);
        let cropped = crop_rgba(
            &src,
            10,
            10,
            CropRect {
                x_dev: 8,
                y_dev: 8,
                width_dev: 20,
                height_dev: 20,
            },
        )
        .unwrap();
        assert_eq!(cropped.width, 2);
        assert_eq!(cropped.height, 2);
    }

    #[test]
    fn crop_rejects_rect_entirely_outside_bounds() {
        let src = row_indexed(10, 10);
        let result = crop_rgba(
            &src,
            10,
            10,
            CropRect {
                x_dev: 10,
                y_dev: 10,
                width_dev: 5,
                height_dev: 5,
            },
        );
        assert!(result.is_err());
    }

    proptest! {
        #[test]
        fn prop_crop_never_reads_out_of_bounds(
            width in 1u32..200,
            height in 1u32..200,
            x in 0u32..250,
            y in 0u32..250,
            w in 1u32..250,
            h in 1u32..250,
        ) {
            let src = row_indexed(width, height);
            let result = crop_rgba(&src, width, height, CropRect { x_dev: x, y_dev: y, width_dev: w, height_dev: h });
            if let Ok(cropped) = result {
                prop_assert!(cropped.width <= width);
                prop_assert!(cropped.height <= height);
                prop_assert_eq!(cropped.rgba.len(), (cropped.width * cropped.height * 4) as usize);
                prop_assert!(x + cropped.width <= width);
                prop_assert!(y + cropped.height <= height);
            }
        }
    }
}
