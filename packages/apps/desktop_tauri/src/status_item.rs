//! The status item of Heidrun in the macOS menu bar: one wide picture with four slots, and a menu that opens on click.
//!
//! The slots, from left to right: blocked agents, finished agents, working agents, Claude quota.
//! The web page sends the data with the command `status_item_update`. This module draws the picture, builds the
//! menu, and tells the web page which agent the user chose in the menu.

use crate::status_item_goat as goat;
use crate::status_item_picture::{self as picture, Effect, Slot, PICTURE_HEIGHT};
use serde::Deserialize;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, Wry};

/// Identifier of the status item inside Tauri.
pub const STATUS_ITEM_ID: &str = "hd-status-item";

/// Name of the event that tells the web page which agent the user chose in the menu. The value is the pane identifier.
pub const SELECT_PANE_EVENT: &str = "status-item-select-pane";

/// Menu item that shows the main window.
const OPEN_MENU_ID: &str = "hd-status-open";

/// Start of the identifier of the menu item of an agent. The pane identifier follows.
const PANE_MENU_ID_PREFIX: &str = "hd-status-pane:";

/// Time between two pictures while a slot moves: twenty pictures per second.
const FRAME_INTERVAL: Duration = Duration::from_millis(50);

const BLOCKED_COLOR: [u8; 3] = [235, 64, 52];
const DONE_COLOR: [u8; 3] = [52, 199, 89];
const WORKING_COLOR: [u8; 3] = [142, 142, 147];
const QUOTA_OK_COLOR: [u8; 3] = [10, 132, 255];
const QUOTA_WARN_COLOR: [u8; 3] = [255, 159, 10];

///////////////////////////////////////////////////////////////////////////////
// Data from the web page
///////////////////////////////////////////////////////////////////////////////

/// One agent in the menu.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatusAgent {
    /// Identifier of the pane of the agent.
    pub pane_id: String,
    /// Name shown in the menu.
    pub name: String,
}

/// The agents of one status, with the title of the section of the menu.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(default)]
pub struct StatusSection {
    /// Title of the section, already translated, with the number of agents.
    pub title: String,
    /// The agents of the section.
    pub agents: Vec<StatusAgent>,
}

/// How much of the quota is used.
#[derive(Deserialize, Clone, Copy, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum QuotaLevel {
    /// Calm.
    #[default]
    Ok,
    /// To watch.
    Warn,
    /// Critical.
    Crit,
}

/// The quota that the fourth slot shows.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(default)]
pub struct StatusQuota {
    /// Share of the quota already used, from 0 to 100.
    pub percent: f64,
    /// How much of the quota is used.
    pub level: QuotaLevel,
    /// Line shown in the menu, already translated.
    pub text: String,
}

/// Everything the status item shows.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct StatusItemPayload {
    /// Agents that wait for an answer.
    pub blocked: StatusSection,
    /// Agents that finished their work.
    pub done: StatusSection,
    /// Agents that work now.
    pub working: StatusSection,
    /// The quota, or `None` when no quota is known.
    pub quota: Option<StatusQuota>,
    /// Text of the menu item that shows the main window, already translated.
    pub open_label: String,
    /// Text of a section without agent, already translated.
    pub empty_label: String,
    /// True when an agent stays blocked for longer than the limit: a red glow pulses behind the whole picture.
    pub is_urgent: bool,
}

/// Name of the environment variable that makes the status item show fake agents, to look at the animations.
const DEMO_VARIABLE: &str = "HEIDRUN_STATUS_ITEM_DEMO";

/// The data that the status item shows now, and the time of its creation, which gives the time of each picture.
pub struct StatusItemState {
    payload: Mutex<StatusItemPayload>,
    started: Instant,
    /// True when the environment variable `HEIDRUN_STATUS_ITEM_DEMO` is set: the data of the web page is ignored.
    is_demo: bool,
}

impl Default for StatusItemState {
    fn default() -> Self {
        let is_demo = std::env::var_os(DEMO_VARIABLE).is_some();
        let payload = if is_demo { demo_payload() } else { StatusItemPayload::default() };
        StatusItemState { payload: Mutex::new(payload), started: Instant::now(), is_demo }
    }
}

/// Fake agents for the demo: two blocked, one finished, three working, and a critical quota.
fn demo_payload() -> StatusItemPayload {
    let section = |title: &str, count: usize| StatusSection {
        title: title.to_string(),
        agents: (1..=count)
            .map(|number| StatusAgent { pane_id: format!("demo-{title}-{number}"), name: format!("Demo · agent {number}") })
            .collect(),
    };
    StatusItemPayload {
        blocked: section("Blocked", 2),
        done: section("Finished", 1),
        working: section("Working", 3),
        quota: Some(StatusQuota { percent: 85.0, level: QuotaLevel::Crit, text: "Demo quota: 85 % used".to_string() }),
        open_label: "Open Heidrun".to_string(),
        empty_label: "No agent".to_string(),
        is_urgent: true,
    }
}

impl StatusItemState {
    fn lock(&self) -> MutexGuard<'_, StatusItemPayload> {
        self.payload.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

///////////////////////////////////////////////////////////////////////////////
// Picture
///////////////////////////////////////////////////////////////////////////////

/// The slots for the data of the web page: the baby goat, then blocked, finished, working, and the quota.
/// The baby goat walks while an agent works.
pub fn slots_for(payload: &StatusItemPayload) -> Vec<Slot> {
    let (quota_percent, quota_color, is_quota_urgent) = match &payload.quota {
        Some(quota) => match quota.level {
            QuotaLevel::Ok => (Some(quota.percent), QUOTA_OK_COLOR, false),
            QuotaLevel::Warn => (Some(quota.percent), QUOTA_WARN_COLOR, false),
            QuotaLevel::Crit => (Some(quota.percent), BLOCKED_COLOR, true),
        },
        None => (None, QUOTA_OK_COLOR, false),
    };
    let mut slots = Vec::new();
    let goat = goat::frames();
    if !goat.is_empty() {
        slots.push(Slot::Sprite { frames: goat, is_walking: !payload.working.agents.is_empty() });
    }
    slots.push(Slot::Disc { count: payload.blocked.agents.len(), color: BLOCKED_COLOR, effect: Effect::Pulse });
    slots.push(Slot::Disc { count: payload.done.agents.len(), color: DONE_COLOR, effect: Effect::None });
    slots.push(Slot::Disc { count: payload.working.agents.len(), color: WORKING_COLOR, effect: Effect::None });
    slots.push(Slot::Ring { percent: quota_percent, color: quota_color, is_urgent: is_quota_urgent });
    slots
}

/// Draws the picture of the status item for the data of the web page, at `time` seconds after the start.
fn draw(payload: &StatusItemPayload, time: f32) -> Image<'static> {
    let slots = slots_for(payload);
    Image::new_owned(picture::draw_frame(&slots, payload.is_urgent, time), picture::picture_width(&slots), PICTURE_HEIGHT)
}

/// True when the picture for the data of the web page looks different from one frame to the next.
fn is_animated(payload: &StatusItemPayload) -> bool {
    picture::is_frame_animated(&slots_for(payload), payload.is_urgent)
}

/// Draws the picture again and gives it to the status item.
fn redraw(app: &AppHandle) {
    let state = app.state::<StatusItemState>();
    let image = draw(&state.lock(), state.started.elapsed().as_secs_f32());
    if let Some(tray) = app.tray_by_id(STATUS_ITEM_ID) {
        let _ = tray.set_icon(Some(image));
    }
}

///////////////////////////////////////////////////////////////////////////////
// Menu
///////////////////////////////////////////////////////////////////////////////

/// The identifier of the menu item of the agent in the pane `pane_id`.
fn pane_menu_id(pane_id: &str) -> String {
    format!("{PANE_MENU_ID_PREFIX}{pane_id}")
}

/// The pane identifier inside the identifier of a menu item, or `None` when the item is not an agent.
fn pane_id_from_menu_id(menu_id: &str) -> Option<&str> {
    menu_id.strip_prefix(PANE_MENU_ID_PREFIX)
}

/// The menu that opens on a click: one section per status, then the quota, then the item that shows the main window.
fn build_menu(app: &AppHandle, payload: &StatusItemPayload) -> tauri::Result<Menu<Wry>> {
    let mut builder = MenuBuilder::new(app);
    for section in [&payload.blocked, &payload.done, &payload.working] {
        builder = builder.item(&MenuItemBuilder::new(&section.title).enabled(false).build(app)?);
        if section.agents.is_empty() {
            builder = builder.item(&MenuItemBuilder::new(&payload.empty_label).enabled(false).build(app)?);
        }
        for agent in &section.agents {
            builder = builder.item(&MenuItemBuilder::with_id(pane_menu_id(&agent.pane_id), &agent.name).build(app)?);
        }
        builder = builder.separator();
    }
    if let Some(quota) = &payload.quota {
        builder = builder.item(&MenuItemBuilder::new(&quota.text).enabled(false).build(app)?).separator();
    }
    builder.item(&MenuItemBuilder::with_id(OPEN_MENU_ID, &payload.open_label).build(app)?).build()
}

/// Shows the main window and gives it the keyboard focus.
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The user chose an item of the menu: the main window comes forward, and the web page selects the agent.
fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    if menu_id == OPEN_MENU_ID {
        focus_main_window(app);
    } else if let Some(pane_id) = pane_id_from_menu_id(menu_id) {
        focus_main_window(app);
        let _ = app.emit(SELECT_PANE_EVENT, pane_id);
    }
}

///////////////////////////////////////////////////////////////////////////////
// Status item
///////////////////////////////////////////////////////////////////////////////

/// Creates the status item in the menu bar and starts the timer that moves the picture.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let payload = app.state::<StatusItemState>().lock().clone();
    TrayIconBuilder::with_id(STATUS_ITEM_ID)
        .icon(draw(&payload, 0.0))
        .icon_as_template(false)
        .menu(&build_menu(app, &payload)?)
        .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
        .build(app)?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(FRAME_INTERVAL);
        loop {
            interval.tick().await;
            if is_animated(&handle.state::<StatusItemState>().lock()) {
                redraw(&handle);
            }
        }
    });
    Ok(())
}

/// Called by the web page each time the agents or the quota change.
#[tauri::command]
pub fn status_item_update(
    app: AppHandle,
    state: State<StatusItemState>,
    payload: StatusItemPayload,
) -> Result<(), String> {
    if state.is_demo {
        return Ok(());
    }
    let menu = build_menu(&app, &payload).map_err(|error| error.to_string())?;
    *state.lock() = payload;
    if let Some(tray) = app.tray_by_id(STATUS_ITEM_ID) {
        tray.set_menu(Some(menu)).map_err(|error| error.to_string())?;
    }
    redraw(&app);
    Ok(())
}

/// Called by the web page when the user shows or hides the status item in the menu bar.
#[tauri::command]
pub fn status_item_set_visible(app: AppHandle, is_visible: bool) -> Result<(), String> {
    match app.tray_by_id(STATUS_ITEM_ID) {
        Some(tray) => tray.set_visible(is_visible).map_err(|error| error.to_string()),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn agent(pane_id: &str) -> StatusAgent {
        StatusAgent { pane_id: pane_id.to_string(), name: format!("name of {pane_id}") }
    }

    #[test]
    fn the_web_page_data_is_read_from_json() {
        let json = r#"{
            "blocked": { "title": "Blocked (1)", "agents": [{ "paneId": "p1", "name": "api · fix" }] },
            "done": { "title": "Finished (0)", "agents": [] },
            "working": { "title": "Working (0)", "agents": [] },
            "quota": { "percent": 73.5, "level": "warn", "text": "Claude: 74 % used" },
            "openLabel": "Open Heidrun",
            "emptyLabel": "No agent"
        }"#;
        let payload: StatusItemPayload = serde_json::from_str(json).expect("the data is valid");
        assert_eq!(payload.blocked.agents, vec![StatusAgent { pane_id: "p1".into(), name: "api · fix".into() }]);
        assert_eq!(payload.quota.as_ref().map(|quota| quota.level), Some(QuotaLevel::Warn));
        assert_eq!(payload.open_label, "Open Heidrun");
    }

    #[test]
    fn the_urgent_flag_is_read_from_json_and_makes_the_picture_move() {
        let urgent: StatusItemPayload = serde_json::from_str(r#"{ "isUrgent": true }"#).expect("the data is valid");
        assert!(urgent.is_urgent);
        assert!(is_animated(&urgent));
        assert!(!is_animated(&StatusItemPayload::default()));
    }

    #[test]
    fn data_without_quota_is_read() {
        let payload: StatusItemPayload = serde_json::from_str(r#"{ "quota": null }"#).expect("the data is valid");
        assert_eq!(payload.quota, None);
        assert!(payload.blocked.agents.is_empty());
    }

    #[test]
    fn the_slots_show_the_number_of_agents_of_each_status() {
        let payload = StatusItemPayload {
            blocked: StatusSection { title: String::new(), agents: vec![agent("p1"), agent("p2")] },
            done: StatusSection { title: String::new(), agents: vec![agent("p3")] },
            ..StatusItemPayload::default()
        };
        let counts: Vec<Option<usize>> = slots_for(&payload)
            .iter()
            .map(|slot| match slot {
                Slot::Disc { count, .. } => Some(*count),
                Slot::Ring { .. } | Slot::Sprite { .. } => None,
            })
            .collect();
        assert_eq!(counts, vec![None, Some(2), Some(1), Some(0), None]);
    }

    #[test]
    fn the_ring_has_the_color_of_the_quota_level_and_a_critical_quota_moves() {
        let quota = |level: QuotaLevel| StatusItemPayload {
            quota: Some(StatusQuota { percent: 90.0, level, text: String::new() }),
            ..StatusItemPayload::default()
        };
        let ring = |payload: &StatusItemPayload| match slots_for(payload).pop() {
            Some(Slot::Ring { color, is_urgent, .. }) => (color, is_urgent),
            _ => panic!("the last slot is a ring"),
        };
        assert_eq!(ring(&quota(QuotaLevel::Ok)), (QUOTA_OK_COLOR, false));
        assert_eq!(ring(&quota(QuotaLevel::Warn)), (QUOTA_WARN_COLOR, false));
        assert_eq!(ring(&quota(QuotaLevel::Crit)), (BLOCKED_COLOR, true));
    }

    #[test]
    fn nothing_moves_when_no_agent_runs_and_the_quota_is_calm() {
        assert!(!picture::is_animated(&slots_for(&StatusItemPayload::default())));
    }

    #[test]
    fn a_finished_agent_does_not_make_the_picture_move() {
        let section = StatusSection { title: String::new(), agents: vec![agent("p1")] };
        let finished = StatusItemPayload { done: section, ..StatusItemPayload::default() };
        assert!(!picture::is_animated(&slots_for(&finished)));
    }

    #[test]
    fn the_baby_goat_walks_while_an_agent_works_and_stands_still_otherwise() {
        let section = StatusSection { title: String::new(), agents: vec![agent("p1")] };
        let working = StatusItemPayload { working: section, ..StatusItemPayload::default() };
        let is_walking = |payload: &StatusItemPayload| match slots_for(payload).first() {
            Some(Slot::Sprite { is_walking, .. }) => *is_walking,
            _ => panic!("the first slot is the baby goat"),
        };
        assert!(is_walking(&working));
        assert!(!is_walking(&StatusItemPayload::default()));
        assert!(picture::is_animated(&slots_for(&working)));
    }

    #[test]
    fn the_demo_has_blocked_agents_and_makes_the_picture_move() {
        let payload = demo_payload();
        assert_eq!(payload.blocked.agents.len(), 2);
        assert!(picture::is_animated(&slots_for(&payload)));
    }

    #[test]
    fn a_blocked_agent_makes_the_picture_move() {
        let payload = StatusItemPayload {
            blocked: StatusSection { title: String::new(), agents: vec![agent("p1")] },
            ..StatusItemPayload::default()
        };
        assert!(picture::is_animated(&slots_for(&payload)));
    }

    #[test]
    fn the_menu_item_of_an_agent_gives_back_its_pane_identifier() {
        assert_eq!(pane_id_from_menu_id(&pane_menu_id("w1-p2")), Some("w1-p2"));
        assert_eq!(pane_id_from_menu_id(OPEN_MENU_ID), None);
    }
}
