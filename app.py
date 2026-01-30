import streamlit as st
from pathlib import Path
import tempfile
import shutil
from validator import run_validation

st.set_page_config(page_title="Crop Filling Validation", layout="wide")

st.title("🌾 Crop Filling Validation")
st.caption("Validate Wherobots vs Legacy Crop Segmentation rasters")

# -----------------------------
# Two upload panels
# -----------------------------
col1, col2 = st.columns(2)

with col1:
    st.subheader("📥 Legacy CS Files")
    legacy_files = st.file_uploader(
        "Upload Legacy .tif files",
        type=["tif"],
        accept_multiple_files=True
    )

with col2:
    st.subheader("📥 Wherobots CS Files")
    new_files = st.file_uploader(
        "Upload Wherobots .tif files",
        type=["tif"],
        accept_multiple_files=True
    )

# -----------------------------
# Run
# -----------------------------
if st.button("🚀 Run Validation"):

    if not legacy_files or not new_files:
        st.error("Please upload files on both sides")
        st.stop()

    # Create temp working directories
    base = Path(tempfile.mkdtemp())
    legacy_dir = base / "legacy"
    new_dir    = base / "wherobots"
    out_dir    = base / "output"

    legacy_dir.mkdir()
    new_dir.mkdir()
    out_dir.mkdir()

    # Save uploaded files
    for f in legacy_files:
        (legacy_dir / f.name).write_bytes(f.read())

    for f in new_files:
        (new_dir / f.name).write_bytes(f.read())

    # Extract season automatically from filenames
    sample_name = legacy_files[0].name
    season = sample_name.split("_")[-1].replace(".tif", "")

    st.info(f"Detected season: {season}")

    try:
        with st.spinner("Running validation..."):
            run_validation(legacy_dir, new_dir, out_dir, season)

        st.success("Validation completed!")

        summary = out_dir / "RID_Validation_Summary.csv"
        matrix  = out_dir / "RID_CropSwitch_Matrix.csv"

        colA, colB = st.columns(2)

        with colA:
            if summary.exists():
                st.subheader("📄 Validation Summary")
                st.dataframe(summary)
                st.download_button(
                    "Download Validation CSV",
                    summary.read_bytes(),
                    file_name="RID_Validation_Summary.csv"
                )

        with colB:
            if matrix.exists():
                st.subheader("🔀 Crop Mismatch Matrix")
                st.dataframe(matrix)
                st.download_button(
                    "Download Crop Switch CSV",
                    matrix.read_bytes(),
                    file_name="RID_CropSwitch_Matrix.csv"
                )

    finally:
        shutil.rmtree(base)
