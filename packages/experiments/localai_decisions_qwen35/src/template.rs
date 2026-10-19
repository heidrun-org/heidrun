//! Renders the `systemone` template of a model with minijinja, as the Jinja engine of llama.cpp v0.6.0
//! (`common/jinja`) renders it.
//!
//! The only difference that changes the prompt of the supported models is the filter `tojson`: llama.cpp
//! keeps the order of the keys, writes UTF-8 as it is, escapes only `"`, `\` and control characters, uses
//! `", "` and `": "` by default, and writes a float as `std::ostream` does (6 significant digits).

use anyhow::{Context as _, Result};
use minijinja::value::{Kwargs, ValueKind};
use minijinja::{Environment, Error, ErrorKind, Value};

/// A compiled `systemone` template.
pub struct SystemOneTemplate {
    environment: Environment<'static>,
}

impl SystemOneTemplate {
    /// Compiles the template source that the model file holds.
    pub fn new(source: &str) -> Result<Self> {
        let mut environment = Environment::new();
        environment.add_filter("tojson", tojson_filter);
        environment
            .add_template_owned("systemone", source.to_string())
            .context("The systemone template of the model is not a valid Jinja template")?;
        Ok(Self { environment })
    }

    /// Renders the template with the keys of `input` as variables.
    pub fn render(&self, input: &serde_json::Value) -> Result<String> {
        let template = self.environment.get_template("systemone")?;
        let text = template
            .render(Value::from_serialize(input))
            .context("Could not render the systemone template of the model")?;
        Ok(text)
    }
}

fn tojson_filter(value: Value, kwargs: Kwargs) -> Result<String, Error> {
    let separators: Option<Vec<String>> = kwargs.get("separators")?;
    let indent: Option<i64> = kwargs.get("indent")?;
    let ensure_ascii: Option<bool> = kwargs.get("ensure_ascii")?;
    let sort_keys: Option<bool> = kwargs.get("sort_keys")?;
    kwargs.assert_all_used()?;
    if sort_keys == Some(true) {
        return Err(Error::new(ErrorKind::InvalidOperation, "tojson sort_keys=true is not implemented"));
    }
    let indent = indent.unwrap_or(-1);
    let separators = separators.unwrap_or_default();
    let item_sep = separators.first().cloned().unwrap_or_else(|| if indent < 0 { ", ".into() } else { ",".into() });
    let key_sep = separators.get(1).cloned().unwrap_or_else(|| ": ".into());
    let mut out = String::new();
    write_json(&mut out, &value, 0, indent, &item_sep, &key_sep)?;
    if ensure_ascii == Some(true) {
        out = escape_non_ascii(&out);
    }
    Ok(out)
}

/// Writes a value as `value_to_json` of llama.cpp does.
pub fn write_json(out: &mut String, value: &Value, level: usize, indent: i64, item_sep: &str, key_sep: &str) -> Result<(), Error> {
    let pad = |level: usize| if indent > 0 { " ".repeat(level * indent as usize) } else { String::new() };
    let newline = if indent >= 0 { "\n" } else { "" };
    match value.kind() {
        ValueKind::Undefined | ValueKind::None => out.push_str("null"),
        ValueKind::Bool => out.push_str(if value.is_true() { "true" } else { "false" }),
        ValueKind::Number => {
            if let Ok(int) = i64::try_from(value.clone()) {
                if value.is_integer() {
                    out.push_str(&int.to_string());
                    return Ok(());
                }
            }
            let float = f64::try_from(value.clone())?;
            out.push_str(&format_float(float));
        }
        ValueKind::String => write_json_string(out, value.as_str().unwrap_or_default()),
        ValueKind::Seq | ValueKind::Iterable => {
            let items: Vec<Value> = value.try_iter()?.collect();
            out.push('[');
            if items.is_empty() == false {
                out.push_str(newline);
                for (i, item) in items.iter().enumerate() {
                    out.push_str(&pad(level + 1));
                    write_json(out, item, level + 1, indent, item_sep, key_sep)?;
                    if i + 1 < items.len() {
                        out.push_str(item_sep);
                    }
                    out.push_str(newline);
                }
                out.push_str(&pad(level));
            }
            out.push(']');
        }
        ValueKind::Map => {
            let keys: Vec<Value> = value.try_iter()?.collect();
            out.push('{');
            if keys.is_empty() == false {
                out.push_str(newline);
                for (i, key) in keys.iter().enumerate() {
                    out.push_str(&pad(level + 1));
                    write_json_string(out, &key.to_string());
                    out.push_str(key_sep);
                    write_json(out, &value.get_item(key)?, level + 1, indent, item_sep, key_sep)?;
                    if i + 1 < keys.len() {
                        out.push_str(item_sep);
                    }
                    out.push_str(newline);
                }
                out.push_str(&pad(level));
            }
            out.push('}');
        }
        _ => out.push_str("null"),
    }
    Ok(())
}

fn write_json_string(out: &mut String, text: &str) {
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn escape_non_ascii(text: &str) -> String {
    let mut out = String::new();
    for c in text.chars() {
        if c.is_ascii() {
            out.push(c);
            continue;
        }
        let mut units = [0u16; 2];
        for unit in c.encode_utf16(&mut units) {
            out.push_str(&format!("\\u{:04x}", unit));
        }
    }
    out
}

/// Writes a float as `std::ostream << double` does by default: `%g` with 6 significant digits.
pub fn format_float(value: f64) -> String {
    if value.is_nan() {
        return "nan".into();
    }
    if value.is_infinite() {
        return if value > 0.0 { "inf".into() } else { "-inf".into() };
    }
    if value == 0.0 {
        return if value.is_sign_negative() { "-0".into() } else { "0".into() };
    }
    // The exponent after rounding to 6 significant digits decides the notation.
    let scientific = format!("{:.5e}", value);
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let exponent: i32 = exponent.parse().unwrap_or(0);
    if exponent < -4 || exponent >= 6 {
        let mantissa = strip_zeros(mantissa);
        let sign = if exponent < 0 { '-' } else { '+' };
        return format!("{mantissa}e{sign}{:02}", exponent.abs());
    }
    let decimals = (5 - exponent).max(0) as usize;
    strip_zeros(&format!("{:.*}", decimals, value))
}

fn strip_zeros(text: &str) -> String {
    if text.contains('.') == false {
        return text.to_string();
    }
    text.trim_end_matches('0').trim_end_matches('.').to_string()
}

#[cfg(test)]
mod tests {
    use super::{format_float, SystemOneTemplate};
    use serde_json::json;

    #[test]
    fn floats_are_written_like_std_ostream() {
        assert_eq!(format_float(0.1), "0.1");
        assert_eq!(format_float(1.5), "1.5");
        assert_eq!(format_float(3.14159265), "3.14159");
        assert_eq!(format_float(100000.0), "100000");
        assert_eq!(format_float(1234567.0), "1.23457e+06");
        assert_eq!(format_float(0.0001), "0.0001");
        assert_eq!(format_float(0.00001234), "1.234e-05");
        assert_eq!(format_float(-2.5), "-2.5");
        assert_eq!(format_float(999999.5), "1e+06");
    }

    #[test]
    fn tojson_keeps_the_order_and_the_utf8_text() {
        let template = SystemOneTemplate::new("{{ value | tojson }}|{{ value | tojson(separators=[',', ':']) }}").unwrap();
        let input = json!({"value": {"z": 1, "a": [true, null, 2.5], "é": "<b> \"q\"\n"}});
        let text = template.render(&input).unwrap();
        assert_eq!(
            text,
            "{\"z\": 1, \"a\": [true, null, 2.5], \"é\": \"<b> \\\"q\\\"\\n\"}|{\"z\":1,\"a\":[true,null,2.5],\"é\":\"<b> \\\"q\\\"\\n\"}"
        );
    }

    #[test]
    fn templates_use_namespace_string_index_and_tests() {
        let source = "{% set ns = namespace(code='a') %}{% set letters = 'ABC' %}{% for o in options %}{% if o.d is not none %}{% set ns.code = 'b' %}{% endif %}{{ letters[loop.index0] }}{% if not loop.last %},{% endif %}{% endfor %} {{ ns.code }} {{ x if x is string else x | tojson }}";
        let template = SystemOneTemplate::new(source).unwrap();
        let text = template.render(&json!({"options": [{"d": null}, {"d": "y"}], "x": {"k": "v"}})).unwrap();
        assert_eq!(text, "A,B b {\"k\": \"v\"}");
    }
}
