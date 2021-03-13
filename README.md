# Personalized Next-Step Recommendation Framework
This repo contains the code and mappings used in:
Le. C.V., Pardos, Z.A., Meyer, S.D., Thorp, R. (in-press) Communication at Scale in a MOOC Using Predictive Engagement Analytics. To appear in Proceedings of the 19th International Conference on Artificial Intelligence in Education (AIED). London, UK. [pdf](http://people.ischool.berkeley.edu/~zp/papers/AIED_communication_at_scale.pdf)

## Sensor
The sensor is plugged into the verticals of the edX course and is inputted as raw html. This code:

1. Logs relevant data to mongodb
2. Requests a recommendation from the models
3. Displays the recommendation and updates the server if the student clicks through

## Server
The server is the backbone of the framework. This code:

1. Receives data from the sensor and logs to mongodb
2. Creates or updates the recent entry for each student (used for calculate the estimated time a student takes on a vertical)
3. Makes a request to the service for a recommendation after querying the mongodb for a student's sequence of events
4. Updates mongodb event with recommendation or if the student followed

```Note : In order for the framework to function, it requires a persistent mongo database.```

## Service
The service is used to process student data and return a recommendation. This code:

1. Processes a student's history stored in the mongodb
2. Uses the processed data to query the LSTM model
3. Returns the recommendation back to the server

## Relevant Files
1. `mappings.csv` - This file is a sample of the mappings for course vertical to an index
2. `axis.csv` - The file is a sample of the course axis which gives us a lot of key information like url_name and path
3. `oracle_forward_stepping.py` - This file is used to process the student's sequence of events and query model for recommendation
