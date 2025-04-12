# Porthmadog Sailing Club Weather Station

Live weather station for the Porthmadog Harbour & Estuary, powered by a Davis Vantage Vue weather station.

## Architecture

A Raspberry Pi Zero W running Balena.io connects to the Davis Vantage Pro2 weather station via a USB cable. The intention was that this would be in a microservices style, but in the end it was easier to just run everything in the same script as it helped the Pi Zero cope!

It uploads it to a Cloudflare worker which then serves the data to the website. The worker also sends the data to The Met Office, Windy.com and Windguru.

## Versioning

This project uses [Semantic Versioning](https://semver.org/), paying more attention to them from `v4.0.0` onwards

## Debugging

Run `npm i` and `npm start`

If debugging on Windows you may need these drivers http://www.ftdichip.com/Drivers/VCP.htm to connect to the Vantage Vue over USB

## [Balena.io](https://balena.io) Configuration

### Device Variables

| **Config Item**      | **Default** |
| -------------------- | ----------- |
| `LOG_LEVEL`          | `silly`     |
| `CLOUDFLARE_API_URL` | _none_      |

### Device Configuration Variables

Following config variables are required to get serial working:

| **Config Item**                 | **Value**                          |
| ------------------------------- | ---------------------------------- |
| `RESIN_HOST_CONFIG_dtparam`     | `"i2c_arm=on","spi=on","audio=on"` |
| `RESIN_HOST_CONFIG_enable_uart` | `enabled`                          |
| `BALENA_HOST_CONFIG_dtoverlay`  | `pi3-miniuart-bt`                  |

Edit the config.txt in balena-boot partition of the SD card and append the following lines.

```
enable_uart=1
```

## Licence

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.
