//! The status item of Heidrun in the macOS menu bar: one wide picture with four slots, and a menu that opens on click.
//!
//! The slots, from left to right: the icon of Heidrun, blocked agents, finished agents, working agents. The
//! quota is not in the picture: the menu shows it.
//! The web page sends the data with the command `status_item_update`. This module draws the picture, builds the
//! menu, and tells the web page which agent the user chose in the menu.

use crate::status_item_icon as icon;
use crate::status_item_picture::{self as picture, Slot, PICTURE_HEIGHT};
use crate::status_item_text as text;
use serde::Deserialize;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{IconMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, Wry};

/// Identifier of the status item inside Tauri.
pub const STATUS_ITEM_ID: &str = "hd-status-item";

/// Name of the event that tells the web page which agent the user chose in the menu. The value is the pane identifier.
pub const SELECT_PANE_EVENT: &str = "status-item-select-pane";

/// Name of the event that tells the web page which quota line the user chose in the menu, so that the web page opens
/// the information card of the status bar section of this quota. The value is the label of the quota.
pub const SHOW_QUOTA_EVENT: &str = "status-item-show-quota";

/// Menu item that shows the main window.
const OPEN_MENU_ID: &str = "hd-status-open";

/// Start of the identifier of the menu item of an agent. The pane identifier follows.
const PANE_MENU_ID_PREFIX: &str = "hd-status-pane:";

/// Start of the identifier of the menu item of a section title. The position of the title in the menu follows.
const TITLE_MENU_ID_PREFIX: &str = "hd-status-title:";

/// Start of the identifier of the menu item of a quota line. The label of the quota follows.
const QUOTA_MENU_ID_PREFIX: &str = "hd-status-quota:";

/// Time between two pictures while a slot moves: twenty pictures per second.
const FRAME_INTERVAL: Duration = Duration::from_millis(50);

const BLOCKED_COLOR: [u8; 3] = [235, 64, 52];
const DONE_COLOR: [u8; 3] = [52, 199, 89];
const WORKING_COLOR: [u8; 3] = [10, 132, 255];
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

/// The quota that a menu line shows.
#[derive(Deserialize, Clone, Default, Debug, PartialEq)]
#[serde(default)]
pub struct StatusQuota {
    /// Label of the quota, the same as in the status bar of the web page, for example `Claude`. The web page opens the
    /// information card of the status bar section with this label when the user chooses the line of the quota.
    pub label: String,
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
    /// The quotas to show, one menu line each: Claude first, then Codex. The list is empty when no quota
    /// is known.
    pub quotas: Vec<StatusQuota>,
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

/// Fake agents for the demo: two blocked, one finished, three working, a critical Claude quota, and a calm Codex
/// quota.
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
        quotas: vec![
            StatusQuota {
                label: "Claude".to_string(),
                percent: 85.0,
                level: QuotaLevel::Crit,
                text: "Demo Claude: 85 % used".to_string(),
            },
            StatusQuota {
                label: "Codex".to_string(),
                percent: 40.0,
                level: QuotaLevel::Ok,
                text: "Demo Codex: 40 % used".to_string(),
            },
        ],
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

/// The slots for the data of the web page: the icon of Heidrun, then blocked, finished, and working. The quota is not
/// in the picture: the status bar of the Heidrun window and the menu of the status item show it. The icon of Heidrun
/// does not move.
pub fn slots_for(payload: &StatusItemPayload) -> Vec<Slot> {
    let mut slots = Vec::new();
    let icon = icon::frames();
    if !icon.is_empty() {
        slots.push(Slot::Sprite { frames: icon, is_walking: false });
    }
    slots.push(Slot::Disc { count: payload.blocked.agents.len(), color: BLOCKED_COLOR });
    slots.push(Slot::Disc { count: payload.done.agents.len(), color: DONE_COLOR });
    slots.push(Slot::Disc { count: payload.working.agents.len(), color: WORKING_COLOR });
    slots
}

/// The color of the badge of a quota in the menu.
fn quota_color(level: QuotaLevel) -> [u8; 3] {
    match level {
        QuotaLevel::Ok => QUOTA_OK_COLOR,
        QuotaLevel::Warn => QUOTA_WARN_COLOR,
        QuotaLevel::Crit => BLOCKED_COLOR,
    }
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

/// The identifier of the menu item of a section title, at the place `position` in the menu, from the top, with the
/// separators counted.
fn title_menu_id(position: usize) -> String {
    format!("{TITLE_MENU_ID_PREFIX}{position}")
}

/// True when the identifier of a menu item is the identifier of a section title.
fn is_title_menu_id(menu_id: &str) -> bool {
    menu_id.starts_with(TITLE_MENU_ID_PREFIX)
}

/// The identifier of the menu item of the quota with the label `label`.
fn quota_menu_id(label: &str) -> String {
    format!("{QUOTA_MENU_ID_PREFIX}{label}")
}

/// The label of the quota inside the identifier of a menu item, or `None` when the item is not a quota line.
fn quota_label_from_menu_id(menu_id: &str) -> Option<&str> {
    menu_id.strip_prefix(QUOTA_MENU_ID_PREFIX)
}

/// The three sections of the menu, from top to bottom, each with the color of the dots of its agents. The colors are
/// the colors of the discs of the picture.
fn sections_with_colors(payload: &StatusItemPayload) -> [(&StatusSection, [u8; 3]); 3] {
    [(&payload.blocked, BLOCKED_COLOR), (&payload.done, DONE_COLOR), (&payload.working, WORKING_COLOR)]
}

/// The picture of the dot that the menu shows before the name of an agent, in `color`.
fn dot_image(color: [u8; 3]) -> Image<'static> {
    Image::new_owned(picture::draw_dot(color), picture::DOT_SIZE, picture::DOT_SIZE)
}

/// The picture of the badge that the menu shows before the name of a quota: the percentage in a pill of `color`,
/// drawn with the system font when the system can.
fn badge_image(percent: f64, color: [u8; 3]) -> Image<'static> {
    let mask = text::render(&picture::badge_text(percent), picture::BADGE_FONT_SIZE);
    Image::new_owned(picture::draw_quota_badge(percent, color, mask.as_ref()), picture::BADGE_WIDTH, picture::BADGE_HEIGHT)
}

/// The picture of the thin gray circle that the menu shows before the text of a section without agent.
fn empty_dot_image() -> Image<'static> {
    Image::new_owned(picture::draw_empty_dot(), picture::DOT_SIZE, picture::DOT_SIZE)
}

/// One line of the menu of the status item.
#[derive(Debug, PartialEq)]
enum MenuLine {
    /// The item that shows the main window. The text is already translated.
    Open(String),
    /// A line between two groups of lines.
    Separator,
    /// The title of a section, already translated, with the number of agents. The item is enabled, so that macOS draws
    /// it in normal black.
    Title(String),
    /// The text of a section without agent, already translated, with a thin gray circle before it so that the line is
    /// indented like the lines of the agents.
    Empty(String),
    /// An agent, with the dot in the color of its section.
    Agent {
        /// Identifier of the pane of the agent.
        pane_id: String,
        /// Name shown in the menu.
        name: String,
        /// Color of the dot.
        color: [u8; 3],
    },
    /// A quota: its name, already translated, and a badge with the percentage in the color of its level. The item is
    /// enabled, so that macOS draws it in normal black.
    Quota {
        /// Label of the quota, the key of its status bar section in the web page.
        label: String,
        /// Name shown in the menu, already translated.
        text: String,
        /// Share of the quota already used, from 0 to 100.
        percent: f64,
        /// Color of the badge.
        color: [u8; 3],
    },
}

/// The lines of the menu that opens on a click, from top to bottom: the item that shows the main window and a
/// separator, then one section per status, then the quotas. The menu never ends with a separator.
fn menu_lines(payload: &StatusItemPayload) -> Vec<MenuLine> {
    let mut lines = vec![MenuLine::Open(payload.open_label.clone()), MenuLine::Separator];
    let sections = sections_with_colors(payload);
    for (index, (section, color)) in sections.iter().enumerate() {
        lines.push(MenuLine::Title(section.title.clone()));
        if section.agents.is_empty() {
            lines.push(MenuLine::Empty(payload.empty_label.clone()));
        }
        for agent in &section.agents {
            lines.push(MenuLine::Agent { pane_id: agent.pane_id.clone(), name: agent.name.clone(), color: *color });
        }
        let is_last_section = index + 1 == sections.len();
        if !is_last_section || !payload.quotas.is_empty() {
            lines.push(MenuLine::Separator);
        }
    }
    for quota in &payload.quotas {
        lines.push(MenuLine::Quota {
            label: quota.label.clone(),
            text: quota.text.clone(),
            percent: quota.percent,
            color: quota_color(quota.level),
        });
    }
    lines
}

/// The menu that opens on a click, built from `menu_lines`. Each agent has a dot in the color of its section.
///
/// macOS draws a disabled menu item in gray, whatever color its text has. The section titles and the quota lines are
/// enabled, so that they show the normal black text of the other lines. Only the lines "None" are disabled, and gray.
fn build_menu(app: &AppHandle, payload: &StatusItemPayload) -> tauri::Result<Menu<Wry>> {
    let mut builder = MenuBuilder::new(app);
    for (position, line) in menu_lines(payload).into_iter().enumerate() {
        builder = match line {
            MenuLine::Open(text) => builder.item(&MenuItemBuilder::with_id(OPEN_MENU_ID, text).build(app)?),
            MenuLine::Separator => builder.separator(),
            MenuLine::Title(text) => {
                builder.item(&MenuItemBuilder::with_id(title_menu_id(position), text).build(app)?)
            }
            MenuLine::Empty(text) => {
                let item = IconMenuItemBuilder::new(text).icon(empty_dot_image()).enabled(false);
                builder.item(&item.build(app)?)
            }
            MenuLine::Quota { label, text, percent, color } => {
                let badge = badge_image(percent, color);
                let item = IconMenuItemBuilder::with_id(quota_menu_id(&label), text).icon(badge);
                builder.item(&item.build(app)?)
            }
            MenuLine::Agent { pane_id, name, color } => {
                let item = IconMenuItemBuilder::with_id(pane_menu_id(&pane_id), name).icon(dot_image(color));
                builder.item(&item.build(app)?)
            }
        };
    }
    builder.build()
}

/// Shows the main window and gives it the keyboard focus.
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The user chose an item of the menu: the main window comes forward. The web page selects the agent of an agent line,
/// and opens the information card of the status bar section of a quota line. A section title only brings the main
/// window forward.
fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    if menu_id == OPEN_MENU_ID || is_title_menu_id(menu_id) {
        focus_main_window(app);
    } else if let Some(pane_id) = pane_id_from_menu_id(menu_id) {
        focus_main_window(app);
        let _ = app.emit(SELECT_PANE_EVENT, pane_id);
    } else if let Some(label) = quota_label_from_menu_id(menu_id) {
        focus_main_window(app);
        let _ = app.emit(SHOW_QUOTA_EVENT, label);
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
            "quotas": [{ "percent": 73.5, "level": "warn", "text": "Claude: 74 % used" }],
            "openLabel": "Open Heidrun",
            "emptyLabel": "No agent"
        }"#;
        let payload: StatusItemPayload = serde_json::from_str(json).expect("the data is valid");
        assert_eq!(payload.blocked.agents, vec![StatusAgent { pane_id: "p1".into(), name: "api · fix".into() }]);
        assert_eq!(payload.quotas.iter().map(|quota| quota.level).collect::<Vec<_>>(), vec![QuotaLevel::Warn]);
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
        let payload: StatusItemPayload = serde_json::from_str(r#"{ "quotas": [] }"#).expect("the data is valid");
        assert!(payload.quotas.is_empty());
        assert!(payload.blocked.agents.is_empty());
    }

    #[test]
    fn the_dots_of_the_menu_have_the_color_of_the_section_of_the_agent() {
        let section = |title: &str| StatusSection { title: title.to_string(), agents: vec![agent(title)] };
        let payload = StatusItemPayload {
            blocked: section("blocked"),
            done: section("done"),
            working: section("working"),
            ..StatusItemPayload::default()
        };
        let colors: Vec<(&str, [u8; 3])> = sections_with_colors(&payload)
            .iter()
            .map(|(section, color)| (section.title.as_str(), *color))
            .collect();
        assert_eq!(colors, vec![("blocked", BLOCKED_COLOR), ("done", DONE_COLOR), ("working", WORKING_COLOR)]);
    }

    #[test]
    fn the_dot_of_the_menu_is_a_square_picture() {
        let image = dot_image(DONE_COLOR);
        assert_eq!((image.width(), image.height()), (picture::DOT_SIZE, picture::DOT_SIZE));
        assert_eq!(image.rgba().len() as u32, picture::DOT_SIZE * picture::DOT_SIZE * 4);
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
                Slot::Sprite { .. } => None,
            })
            .collect();
        assert_eq!(counts, vec![None, Some(2), Some(1), Some(0)]);
    }

    #[test]
    fn the_picture_has_no_ring_for_the_quotas() {
        let quota = |percent: f64| StatusQuota { percent, level: QuotaLevel::Crit, ..StatusQuota::default() };
        let without_quota = StatusItemPayload::default();
        let with_quotas = StatusItemPayload { quotas: vec![quota(20.0), quota(95.0)], ..StatusItemPayload::default() };
        let width = |payload: &StatusItemPayload| picture::picture_width(&slots_for(payload));
        assert_eq!(slots_for(&with_quotas).len(), slots_for(&without_quota).len());
        assert_eq!(width(&with_quotas), width(&without_quota));
        assert!(!picture::is_animated(&slots_for(&with_quotas)));
    }

    #[test]
    fn the_blocked_finished_and_working_discs_are_red_green_and_blue() {
        let colors: Vec<[u8; 3]> = slots_for(&StatusItemPayload::default())
            .iter()
            .filter_map(|slot| match slot {
                Slot::Disc { color, .. } => Some(*color),
                _ => None,
            })
            .collect();
        assert_eq!(colors, vec![[235, 64, 52], [52, 199, 89], [10, 132, 255]]);
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
    fn the_first_slot_is_the_icon_of_heidrun_and_it_does_not_move_while_an_agent_works() {
        let section = StatusSection { title: String::new(), agents: vec![agent("p1")] };
        let working = StatusItemPayload { working: section, ..StatusItemPayload::default() };
        match slots_for(&working).first() {
            Some(Slot::Sprite { frames, is_walking }) => {
                assert_eq!(frames.len(), 1);
                assert!(!is_walking);
            }
            _ => panic!("the first slot is the icon of Heidrun"),
        }
        assert!(!picture::is_animated(&slots_for(&working)));
    }

    #[test]
    fn the_demo_has_blocked_agents_and_makes_the_picture_move() {
        let payload = demo_payload();
        assert_eq!(payload.blocked.agents.len(), 2);
        assert!(is_animated(&payload));
    }

    #[test]
    fn a_blocked_agent_alone_does_not_make_the_picture_move() {
        let payload = StatusItemPayload {
            blocked: StatusSection { title: String::new(), agents: vec![agent("p1")] },
            ..StatusItemPayload::default()
        };
        assert!(!picture::is_animated(&slots_for(&payload)));
    }

    #[test]
    fn the_menu_starts_with_the_item_that_opens_heidrun_and_a_separator() {
        let payload = StatusItemPayload { open_label: "Open Heidrun".into(), ..demo_payload() };
        let lines = menu_lines(&payload);
        assert_eq!(lines[0], MenuLine::Open("Open Heidrun".into()));
        assert_eq!(lines[1], MenuLine::Separator);
        assert!(matches!(lines[2], MenuLine::Title(_)));
        let open_count = lines.iter().filter(|line| matches!(line, MenuLine::Open(_))).count();
        assert_eq!(open_count, 1);
    }

    #[test]
    fn the_menu_has_no_separator_at_its_end() {
        assert_ne!(menu_lines(&StatusItemPayload::default()).last(), Some(&MenuLine::Separator));
        assert_ne!(menu_lines(&demo_payload()).last(), Some(&MenuLine::Separator));
    }

    #[test]
    fn a_separator_stands_between_two_sections_and_before_the_quotas() {
        let separators = |payload: &StatusItemPayload| {
            menu_lines(payload).iter().filter(|line| **line == MenuLine::Separator).count()
        };
        assert_eq!(separators(&StatusItemPayload::default()), 3);
        assert_eq!(separators(&demo_payload()), 4);
    }

    #[test]
    fn each_agent_line_has_the_color_of_its_section() {
        let section = |name: &str| StatusSection { title: name.to_string(), agents: vec![agent(name)] };
        let payload = StatusItemPayload {
            blocked: section("blocked"),
            done: section("done"),
            working: section("working"),
            ..StatusItemPayload::default()
        };
        let colors: Vec<[u8; 3]> = menu_lines(&payload)
            .into_iter()
            .filter_map(|line| match line {
                MenuLine::Agent { color, .. } => Some(color),
                _ => None,
            })
            .collect();
        assert_eq!(colors, vec![BLOCKED_COLOR, DONE_COLOR, WORKING_COLOR]);
    }

    #[test]
    fn a_section_without_agent_shows_the_empty_text_and_the_quotas_come_last() {
        let payload = StatusItemPayload {
            empty_label: "No agent".into(),
            quotas: vec![StatusQuota {
                label: "Codex".into(),
                percent: 1.0,
                level: QuotaLevel::Ok,
                text: "Codex quota".into(),
            }],
            ..StatusItemPayload::default()
        };
        let lines = menu_lines(&payload);
        assert_eq!(lines.iter().filter(|line| **line == MenuLine::Empty("No agent".into())).count(), 3);
        let quota = MenuLine::Quota {
            label: "Codex".into(),
            text: "Codex quota".into(),
            percent: 1.0,
            color: QUOTA_OK_COLOR,
        };
        assert_eq!(lines.last(), Some(&quota));
    }

    #[test]
    fn the_badge_of_a_quota_has_the_color_of_its_level_and_the_picture_has_the_same_size_for_every_percentage() {
        let quota = |percent: f64, level: QuotaLevel| StatusQuota { percent, level, ..StatusQuota::default() };
        let payload = StatusItemPayload {
            quotas: vec![quota(5.0, QuotaLevel::Ok), quota(70.0, QuotaLevel::Warn), quota(97.0, QuotaLevel::Crit)],
            ..StatusItemPayload::default()
        };
        let colors: Vec<[u8; 3]> = menu_lines(&payload)
            .into_iter()
            .filter_map(|line| match line {
                MenuLine::Quota { color, .. } => Some(color),
                _ => None,
            })
            .collect();
        assert_eq!(colors, vec![QUOTA_OK_COLOR, QUOTA_WARN_COLOR, BLOCKED_COLOR]);
        for percent in [0.0, 1.0, 34.0, 100.0] {
            let image = badge_image(percent, QUOTA_OK_COLOR);
            assert_eq!((image.width(), image.height()), (picture::BADGE_WIDTH, picture::BADGE_HEIGHT));
        }
    }

    #[test]
    fn the_menu_item_of_a_title_has_its_own_kind_of_identifier() {
        let id = title_menu_id(4);
        assert!(is_title_menu_id(&id));
        assert_ne!(id, title_menu_id(5));
        assert_eq!(pane_id_from_menu_id(&id), None);
        assert_eq!(quota_label_from_menu_id(&id), None);
        assert!(!is_title_menu_id(OPEN_MENU_ID));
        assert!(!is_title_menu_id(&pane_menu_id("w1-p2")));
        assert!(!is_title_menu_id(&quota_menu_id("Claude")));
    }

    #[test]
    fn the_menu_item_of_a_quota_line_gives_back_the_label_of_its_quota() {
        assert_eq!(quota_label_from_menu_id(&quota_menu_id("Claude")), Some("Claude"));
        assert_ne!(quota_menu_id("Claude"), quota_menu_id("Codex"));
        assert_eq!(quota_label_from_menu_id(OPEN_MENU_ID), None);
        assert_eq!(quota_label_from_menu_id(&pane_menu_id("w1-p2")), None);
        assert_eq!(pane_id_from_menu_id(&quota_menu_id("Claude")), None);
    }

    #[test]
    fn the_quota_lines_of_the_menu_carry_the_label_of_their_quota() {
        let labels: Vec<String> = menu_lines(&demo_payload())
            .into_iter()
            .filter_map(|line| match line {
                MenuLine::Quota { label, .. } => Some(label),
                _ => None,
            })
            .collect();
        assert_eq!(labels, vec!["Claude".to_string(), "Codex".to_string()]);
    }

    #[test]
    fn the_label_of_a_quota_is_read_from_json() {
        let json = r#"{ "quotas": [{ "label": "Claude", "percent": 35.0, "level": "ok", "text": "Claude quota" }] }"#;
        let payload: StatusItemPayload = serde_json::from_str(json).expect("the data is valid");
        assert_eq!(payload.quotas[0].label, "Claude");
    }

    #[test]
    fn the_menu_item_of_an_agent_gives_back_its_pane_identifier() {
        assert_eq!(pane_id_from_menu_id(&pane_menu_id("w1-p2")), Some("w1-p2"));
        assert_eq!(pane_id_from_menu_id(OPEN_MENU_ID), None);
    }
}
