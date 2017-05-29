#!/usr/bin/env bash
cp -n weatherdatabase.sqlite3 /data/weatherdatabase.sqlite3 #Copy a blank db if it doesn't exist

python3 /usr/src/app/main.py