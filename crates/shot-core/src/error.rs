use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlanError {
    InvalidDpr,
    InvalidViewport,
    InvalidTotalHeight,
    NoObservations,
    InvalidBitmapHeight { slice_index: usize },
}

impl fmt::Display for PlanError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PlanError::InvalidDpr => write!(f, "device pixel ratio must be finite and > 0"),
            PlanError::InvalidViewport => {
                write!(f, "viewport dimensions must be finite and > 0")
            }
            PlanError::InvalidTotalHeight => {
                write!(f, "total page height must be finite and >= 0")
            }
            PlanError::NoObservations => write!(f, "at least one slice observation is required"),
            PlanError::InvalidBitmapHeight { slice_index } => {
                write!(f, "slice {slice_index} has a zero-height bitmap")
            }
        }
    }
}

impl std::error::Error for PlanError {}

#[derive(Debug)]
pub enum StitchError {
    Plan(PlanError),
    Decode {
        slice_index: usize,
        message: String,
    },
    WidthMismatch {
        slice_index: usize,
        expected: u32,
        actual: u32,
    },
    Encode(String),
}

impl fmt::Display for StitchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StitchError::Plan(e) => write!(f, "{e}"),
            StitchError::Decode {
                slice_index,
                message,
            } => {
                write!(f, "failed to decode slice {slice_index}: {message}")
            }
            StitchError::WidthMismatch {
                slice_index,
                expected,
                actual,
            } => write!(
                f,
                "slice {slice_index} width {actual}px does not match session width {expected}px \
                 (page likely resized mid-capture; caller should abort and restart)"
            ),
            StitchError::Encode(msg) => write!(f, "encode failed: {msg}"),
        }
    }
}

impl std::error::Error for StitchError {}

impl From<PlanError> for StitchError {
    fn from(e: PlanError) -> Self {
        StitchError::Plan(e)
    }
}
