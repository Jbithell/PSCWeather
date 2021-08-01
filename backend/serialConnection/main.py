log("[INFO] Current time " + str(time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())))

log("[INFO] Ready to start getting data")
previousworkingresponse = "" #Global var
errorcount = 0
windSpeeds = {} #Format: timestamp:windSpeedAtThatInstant
def looprequest():
    global previousworkingresponse, errorcount, windSpeeds
    ser.write(bytes(str("LOOP 1 \n"), 'utf8')) #Send a request to the data logger
    response = b""
    for i in range(4):
        response = response + ser.readline()
    data = {}
    thisresponse = response
    #if (len(thisresponse) < 100):
    #    log("[ERROR] Data too short")
    #    errorcount = errorcount + 1
    #    return False
    if (len(response) < 1) or (int(response[0]) != 6):
        log("[ERROR] Device failed to respond with ASCII ACK")
        errorcount = errorcount + 1
        # Didn't respond with an Ascii acknowlegement
        return False

    for key in list(windSpeeds.keys()): #Remove items that are older than 5 minutes from the list of gust speeds
        if int(key) < (time.time()-300):
            del windSpeeds[key]
    try:
        
    except Exception as e:
        log("[ERROR] Ignoring data because of error: " + str(e))
        errorcount = errorcount + 1
        return False

    #print(str(chr(response[1])) + str(chr(response[2])) + str(chr(response[3]))) #Should be LOO
    if data["windSpeed"] == 255 and data["humidity"] == 255:  # This happens when console in setup mode
        log("[ERROR] CONSOLE IN SETUP MENU OR STATION DISCONNECTED (Ignoring data because of 255 speed and humidity)")
        time.sleep(30) #Wait 30 seconds in an attempt to stop it being spammed over the winter
        errorcount = errorcount + 1
        return False  # Ignore - there's very little we can do remotely :(
    elif data["windSpeed"] > 80 or data["temperatureC"] > 50 or data["humidity"] > 100 or data["windDirection"] > 360:
        capture_message(repr(data))
        capture_message(response.decode("utf-8"))
        log("[INFO] Ignoring data because it's a bit weird")
        return False
    elif data["windSpeed"] == 0 and data["windDirection"] == 0: #This indicates it's struggling for data so ignore
        log("[INFO] Ignoring data because of 0 wind direction and speed")
        errorcount = errorcount + 1
        return False
    else:
        if data["wind10MinAverage"] == 255:
            data["wind10MinAverage"] = data["windSpeed"]
            errorcount = errorcount + 1
        previousworkingresponse = thisresponse
        return data


lastSentToServerTime = 0  # Make a request immediately

while True:
    data = looprequest()
    if data:
        #if (time.time()-lastSentToServerTime) > int(os.environ.get('serverSendFrequency', 60)): #Send the server a reading every minute
        #Not currently uploading anything to any servers because it makes more sense to go serverless
        try:
            pusher_client.trigger('PSCWeatherDataLive', 'PSCWeatherDataLiveNEWReading', {'message': {'reading': data}})
            log("[SUCCESS] Sent Data to Pusher.com")
        except Exception as e:
            log("[ERROR] Couldn't upload data to Pusher " + str(e))
            reboot()

    if errorcount > 5: #If it's hit an error more than 5 times just reboot it
        reboot()

    time.sleep(2) #Only take a reading every two seconds as the device itself only updates on roughly that frequency

log("[INFO] End of Program")