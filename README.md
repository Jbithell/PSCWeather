# Porthmadog Sailing Club Weather Station

Live weather station for the Porthmadog Harbour & Estuary, powered by a Davis Vantage Pro2 weather station.

![Screenshot](.github/screenshot1.png)

## Architecture 

This repo is a monorepo. 

The system is made up of a number of components:

- `backend/` - A Raspberry Pi Zero W running Balena.io connects to the Davis Vantage Pro2 weather station via a USB cable. A series of nodejs docker containers, connected via a [bull](https://github.com/OptimalBits/bull) queue, processes the data. These containers include:
  - `serialConnection` - Maintains the serial connection to the weather station, and fires the data received over to....
  - `parser` - Parses the data from the weather station into an object format, and writes it to an SQLite database.
  - `server` - Server to return this data to the client (via the frontend)
  - `backup` - Converts batches of rows from the SQLite database and uploads them to an S3 bucket, for archiving/retention purposes, and also to reduce load on the `server` container.
- `frontend/` - the frontend web application, written in React. Hosted on Github Pages.

## Versioning

This project uses [Semantic Versioning](https://semver.org/), paying more attention to them from `v4.0.0` onwards

## [Balena.io](https://balena.io) Configuration 

Following config variables are required to get serial working:

**Config Item**|**Value**
-----|-----
`RESIN_HOST_CONFIG_dtparam` | `"i2c_arm=on","spi=on","audio=on"`
`RESIN_HOST_CONFIG_enable_uart` | `enabled`
`BALENA_HOST_CONFIG_dtoverlay` | `pi3-miniuart-bt`

Edit the config.txt in balena-boot partition of the SD card and append the following lines.
```
enable_uart=1
```

## Licence 

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.