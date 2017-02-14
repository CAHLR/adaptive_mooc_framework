from flask import Flask, request

import keras
import recreate_keras_model
import csv
import numpy as np
from keras.preprocessing import sequence

from oracle_forward_stepping import *

app = Flask(__name__)

def find_best(seq):
    result = forward_step_to_meaningful_bucket(seq) #Returns either -1 or a 3-element tuple of (index, time bucket, # forward steps used). Filters input sequence on blacklisted events and repeats
    if result == -1:
        return result
    else:
        return result[0]

@app.route('/rec', methods=['POST'])
def get_rec():
    events = request.form['events']
    nums = events.split(" ")
    offset = len(nums) // 2
    seq = []
    i = 0
    while i < len(nums) // 2:
        seq.append([int(nums[i]), int(nums[i+offset])])
        i += 1
    return str(find_best(seq))

if __name__ == '__main__':
    app.run(host='server', port=port, processes=45)
