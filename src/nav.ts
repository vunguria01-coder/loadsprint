import { Linking, Platform } from "react-native";

// Open the phone's navigation to a single destination.
export async function navigateTo(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${q}&dirflg=d`,
    android: `google.navigation:q=${q}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  })!;
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
  }
}

// Open a full origin -> destination route in Google Maps (works on both OSes).
export async function navigateRoute(origin: string, dest: string) {
  const o = encodeURIComponent(origin);
  const d = encodeURIComponent(dest);
  await Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`
  );
}

// Truck-legal routing: open Trucker Path if installed, otherwise fall back to
// the regular maps app. (Real truck routing — bridge height, weight, hazmat —
// requires a paid maps API; Trucker Path is the practical, free-to-open option.)
export async function navigateTruck(address: string) {
  const q = encodeURIComponent(address);
  const deep = `truckerpath://search?q=${q}`;
  try {
    const supported = await Linking.canOpenURL(deep);
    if (supported) {
      await Linking.openURL(deep);
      return;
    }
  } catch {
    /* fall through */
  }
  await navigateTo(address);
}
