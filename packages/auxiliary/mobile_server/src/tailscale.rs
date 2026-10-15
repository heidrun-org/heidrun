//! The Tailscale address of the Mac: the only address on which the mobile server listens.

use std::net::{IpAddr, Ipv4Addr};

/// The Mac's Tailscale address (100.64.0.0/10). Never another interface.
pub fn tailscale_ip() -> Option<Ipv4Addr> {
    // For tests on this Mac only: a Tailscale or loopback address, never 0.0.0.0.
    if let Ok(v) = std::env::var("HEIDRUN_MOBILE_BIND") {
        return v.parse::<Ipv4Addr>().ok().filter(|ip| is_tailscale(*ip) || ip.is_loopback());
    }
    if_addrs::get_if_addrs().ok()?.into_iter().find_map(|i| match i.ip() {
        IpAddr::V4(v4) if is_tailscale(v4) => Some(v4),
        _ => None,
    })
}

/// True for an address of the range 100.64.0.0/10, the range that Tailscale uses.
pub fn is_tailscale(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    o[0] == 100 && (64..=127).contains(&o[1])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_tailscale_range_passes() {
        assert!(is_tailscale("100.64.0.1".parse().unwrap()));
        assert!(is_tailscale("100.101.5.9".parse().unwrap()));
        assert!(!is_tailscale("100.128.0.1".parse().unwrap()));
        assert!(!is_tailscale("192.168.1.10".parse().unwrap()));
    }

    #[test]
    fn the_range_has_exact_edges() {
        assert!(is_tailscale(Ipv4Addr::new(100, 64, 0, 0)));
        assert!(is_tailscale(Ipv4Addr::new(100, 127, 255, 255)));
        assert!(!is_tailscale(Ipv4Addr::new(100, 63, 255, 255)));
        assert!(!is_tailscale(Ipv4Addr::new(100, 128, 0, 0)));
        assert!(!is_tailscale(Ipv4Addr::new(192, 168, 1, 10)));
        assert!(!is_tailscale(Ipv4Addr::new(10, 64, 0, 1)));
    }
}
