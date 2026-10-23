//! Each case runs in its own process, so environment changes cannot affect concurrently running data tests.
use std::path::PathBuf;
use std::process::Command;

#[test]
fn every_data_layer_uses_the_selected_application_folder() {
    if std::env::var_os("HEIDRUN_CODE_PATH_TEST_CHILD").is_none() {
        for folder in [Some("/tmp/heidrun-640-development-data"), Some(""), None] {
            let mut command = Command::new(std::env::current_exe().unwrap());
            command.args([
                "--exact",
                "every_data_layer_uses_the_selected_application_folder",
                "--nocapture",
            ]);
            command.env("HEIDRUN_CODE_PATH_TEST_CHILD", "1");
            match folder {
                Some(folder) => {
                    command.env("HEIDRUN_CODE_DIR", folder);
                }
                None => {
                    command.env_remove("HEIDRUN_CODE_DIR");
                }
            }
            let output = command.output().unwrap();
            assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stdout));
        }
        return;
    }
    let folder = std::env::var("HEIDRUN_CODE_DIR")
        .ok()
        .or_else(|| std::env::var("HEIDRUN_DIR").ok())
        .filter(|value| value.is_empty() == false)
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let config = dirs::home_dir().unwrap().join(".config");
            if config.join("heidrun_code").is_dir() == false && config.join("heidrun").is_dir() {
                return config.join("heidrun");
            }
            config.join("heidrun_code")
        });
    let database = folder.join("data_layer.sqlite");
    assert_eq!(data_layer_code_hosting::default_database_path(), database);
    assert_eq!(data_layer_coding_agents::default_database_path(), database);
    assert_eq!(data_layer_source_control::default_database_path(), database);
    assert_eq!(data_layer_user_activity::default_database_path(), database);
    assert_eq!(heidrun_code_data::default_database_path(), database);
}
