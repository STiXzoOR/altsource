// Adapted from therealFoxster/altsource-viewer (MIT); icon names refer to Hugeicons (@hugeicons/core-free-icons). See THIRD_PARTY.md.
export default {
  "com.apple.security.application-groups": {
    "name": "App Groups",
    "description": "Allow app to share files with other apps and app extensions in the same App Group.",
    "icon": "GridIcon"
  },
  "com.apple.developer.associated-domains": {
    "name": "Associated Domains",
    "description": "The associated domains for specific services, such as shared web credentials, universal links, and App Clips.",
    "icon": "Globe02Icon"
  },
  "com.apple.developer.carplay-audio": {
    "name": "CarPlay Audio",
    "description": "Allows the app the provide audio content for CarPlay.",
    "icon": "Car01Icon"
  },
  "get-task-allow": {
    "name": "Debuggable",
    "description": "Allow developers to attach a debugger to this app. This permission is required for JIT to work.",
    "icon": "Bug01Icon"
  },
  "com.apple.developer.device-information.user-assigned-device-name": {
    "name": "Device Name",
    "description": "Grants access to the user-assigned device name instead of a generic device name.",
    "icon": "SmartPhone01Icon"
  },
  "keychain-access-groups": {
    "name": "Keychain",
    "description": "Allows app to read and write secure data to the system's keychain.",
    "icon": "Key01Icon"
  },
  "com.apple.developer.networking.multicast": {
    "name": "Multicast",
    "description": "App can send or receive IP multicast traffic.",
    "icon": "Globe02Icon"
  },
  "aps-environment": {
    "name": "Push Notifications",
    "description": "App can send push notifications.",
    "icon": "Notification01Icon"
  },
  "com.apple.developer.applesignin": {
    "name": "Sign in with Apple",
    "description": "Allows sign in with Apple.",
    "icon": "AppleIcon"
  },
  "com.apple.developer.siri": {
    "name": "Siri",
    "description": "Allows app to handle Siri requests.",
    "icon": "Mic01Icon"
  },
  "com.apple.developer.networking.wifi-info": {
    "name": "Wi-Fi Information Access",
    "description": "Allows app to access information about the connected Wi-Fi network.",
    "icon": "Wifi01Icon"
  },
  "com.apple.developer.group-session": {
    "name": "Group Activities",
    "description": "Allows the app to schedule and participate in group activities.",
    "icon": "UserMultipleIcon"
  },
  "com.apple.developer.icloud-container-identifiers": {
    "name": "iCloud Container Identifiers",
    "description": "App can set up iCloud identifiers used for testing environments.",
    "icon": "CloudIcon"
  },
  "com.apple.developer.ubiquity-kvstore-identifier": {
    "name": "iCloud Key-Value Store",
    "description": "The container identifier to use for iCloud key-value storage.",
    "icon": "CloudIcon"
  },
  "com.apple.developer.weatherkit": {
    "name": "Weather Data",
    "description": "Allows app to use WeatherKit.",
    "icon": "SunCloud01Icon"
  },
  "com.apple.developer.kernel.increased-memory-limit": {
    "name": "Increased Memory Limit",
    "description": "Lets the app use more memory than iOS normally allows, for large workloads such as virtual machines, games and emulators.",
    "icon": "CpuIcon"
  },
  "com.apple.developer.kernel.extended-virtual-addressing": {
    "name": "Extended Virtual Addressing",
    "description": "Lets the app address more virtual memory. Used together with the increased memory limit by emulators and virtual machines.",
    "icon": "CpuIcon"
  },
  "dynamic-codesigning": {
    "name": "Just-In-Time Compilation",
    "description": "Lets the app generate and run code at runtime (JIT). Emulators and virtual machines are much faster with it; it only works when JIT is enabled on the device.",
    "icon": "FlashIcon"
  },
  "com.apple.private.hypervisor": {
    "name": "Hypervisor",
    "description": "Access to the hardware hypervisor to run virtual machines natively. Only available on some devices and when the app is installed in a way that keeps this entitlement.",
    "icon": "ComputerIcon"
  },
  "com.apple.vm.device-access": {
    "name": "Virtual Machine Device Access",
    "description": "Lets a virtual machine talk to device hardware such as USB and networking.",
    "icon": "UsbIcon"
  },
  "com.apple.security.exception.iokit-user-client-class": {
    "name": "Hardware Access",
    "description": "Allows the app to talk to selected hardware drivers directly.",
    "icon": "ChipIcon"
  },
  "com.apple.security.iokit-user-client-class": {
    "name": "Hardware Access",
    "description": "Allows the app to talk to selected hardware drivers directly.",
    "icon": "ChipIcon"
  },
  "com.apple.private.memorystatus": {
    "name": "Memory Status",
    "description": "Lets the app read and adjust its own memory pressure status so large workloads are not terminated early.",
    "icon": "CpuIcon"
  },
  "com.apple.system.diagnostics.iokit-properties": {
    "name": "Hardware Diagnostics",
    "description": "Lets the app read hardware diagnostic properties.",
    "icon": "Stethoscope02Icon"
  },
  "com.apple.private.iokit.IOServiceSetAuthorizationID": {
    "name": "Hardware Authorization",
    "description": "Lets the app authorise its own connection to hardware services.",
    "icon": "Key01Icon"
  },
  "platform-application": {
    "name": "Platform Application",
    "description": "Marks the app as a system-level application, which lifts some sandbox restrictions when the installer keeps this entitlement.",
    "icon": "Shield01Icon"
  }
};
