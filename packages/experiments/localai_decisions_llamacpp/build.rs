// Builds the C wrapper of the Clef decision order, and checks that the feature `metal` and the
// environment variable GGML_METAL agree.

fn main() {
    println!("cargo:rerun-if-changed=src/clef_decision_order.cpp");
    println!("cargo:rerun-if-env-changed=GGML_METAL");

    let metal_feature = std::env::var("CARGO_FEATURE_METAL").is_ok();
    let metal_variable = std::env::var("GGML_METAL").unwrap_or_default();
    if metal_feature && metal_variable != "ON" {
        panic!("The feature `metal` needs the environment variable GGML_METAL=ON, for example: GGML_METAL=ON cargo build --release --features metal");
    }

    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .file("src/clef_decision_order.cpp")
        .compile("clef_decision_order");
}
