import keras
import recreate_keras_model
import csv
import numpy as np
import operator
import functools
from keras.preprocessing import sequence

mappingsfname = 'mappings.csv'
mappings = {}
with open(mappingsfname, 'rt') as csvfile:
    mappingsreader = csv.reader(csvfile)
    for row in mappingsreader:
        mappings[int(row[0])] = row[1]
vocab_size = len(mappings)

keras_model = recreate_keras_model.load_saved_weights(1,128,.01,160,'rmsprop',64,16, 'folder_with_weights', 'weights', vocab_size)

history = {}
def return_softmax(model, test_x):
    predictions = model.predict(test_x, batch_size = 1)[0]
    return_list = [] #one elem per student in validatio
    indices = list(test_x[0][0])
    counter = 0
    for index in indices:
        if index == 0:
            break
        else:
            current_softmax_prediction = list(predictions[counter])
            return_list.append(current_softmax_prediction)
            counter += 1
            1
    return return_list
def resolve_to_new_mapping(initial_index, time_bucket):
    if initial_index == 1:
        return 1
    else:
        return initial_index * 4 - 6 + time_bucket

def revert_to_old_mapping(index):
    if index == 1:
        return 1
    else:
        return (index + 6) // 4

buckets = ([0, 11],[11, 61],[61, 1800],[1800, 99999999999999])

def resolve_to_bucket(seconds, buckets=buckets):
    i = 0
    for pair in buckets:
        lower = pair[0]
        upper = pair[1]
        if lower <= seconds < upper:
            return i
        else:
            i+=1

def which_time_bucket(index):
    if index == 1:
        return 1
    else:
        return (index+ 2) % 4

indices_to_drop = [2, 3, 4, 5, 6, 7, 140]
def remove_continguous_repeats_and_take_max_bucket(pairlist):
    """
    """
    previous_elem = False
    result_list = []
    current_max_bucket = -1
    for i in range(len(pairlist)):
        current_elem = list(pairlist[i])
        if previous_elem:
            if current_elem[0] == previous_elem:
                current_max_bucket = max(current_max_bucket, current_elem[1])
                if result_list[-1][1] < current_max_bucket:
                    result_list[-1][1] = current_max_bucket
                continue
            else:
                previous_elem = current_elem[0]
                current_max_bucket = current_elem[1]
                result_list.append(current_elem)
        else:
            previous_elem = current_elem[0]
            result_list.append(current_elem)
    return result_list


def query_model(model, student_sequence, using_time = False, using_y_time = True):
    """
    student_sequence looks like [(a, b), (c, d)] where a, c are indices and b, d are time buckets.
    """
    if using_time:
        student_sequence = [resolve_to_new_mapping(p[0], p[1]) for p in student_sequence]
        print(student_sequence)
    else:
        student_sequence = student_sequence

    #Removing blacklisted elements
    student_sequence = [elem for elem in student_sequence if elem[0] not in indices_to_drop]
    #Taking max time bucket of repeats
    student_sequence = remove_continguous_repeats_and_take_max_bucket(student_sequence)

    if len(student_sequence) < 1:
        print("Student sequence is empty. Returning -1")
        return -1

    x = [p[0] for p in student_sequence]
    ve_t = [p[1] for p in student_sequence]
    v_t = []
    for buck in ve_t:
        a = [0, 0, 0, 0]
        a[buck] = 1
        b = np.array(a)
        v_t.append(b)
    v_t = np.array(v_t)
    x = sequence.pad_sequences([x], maxlen = len(x), padding = 'post', truncating = 'post')
    v_t = sequence.pad_sequences([v_t], maxlen = len(v_t), padding = 'post', truncating = 'post', dtype='bool')
    softmax_results = return_softmax(model, [x, v_t])
    return softmax_results

def convert_softmax_output_to_best_time_bucket(softmax_results):
    """
    Is only interested in the last prediction.
    """
    last_softmax = softmax_results[-1]
    current_best_time_buckets = {0: (0, 0), 1: (0, 0), 2: (0, 0), 3: (0, 0)} #values are (index, probability)
    for i, p in enumerate(last_softmax):
        mapping_index = i+1
        current_time_bucket = which_time_bucket(mapping_index)
        current_best_index = current_best_time_buckets[current_time_bucket][0]
        current_best_p = current_best_time_buckets[current_time_bucket][1]
        if p > current_best_p:
            current_best_time_buckets[current_time_bucket] = (mapping_index, p)
    return current_best_time_buckets

def print_time_bucket_results(best_time_buckets):
    for time_bucket, best_result in best_time_buckets.items():
        print("Best prediction for bucket "+str(time_bucket)+": " + str(revert_to_old_mapping(best_result[0])) + " with probablity "+str(best_result[1]))
        print("This index maps to url: " + mappings[revert_to_old_mapping(best_result[0])])

using_y_time = True

def found_every_time_as_best(buckets_found_so_far):
    return (0, 0, 0) not in list(buckets_found_so_far.values())

def print_bucketed_results_nicely(buckets_found):
    for k, v in buckets_found.items():
        if v == (0, 0, 0):
            print("For time bucket " + str(k) + " no prediction was found.")
        else:
            print("The next earliest action for bucket " + str(k) + " is predicted at timestep " + str(v[2]) + ". Index " + str(revert_to_old_mapping(v[0])) + " with probability " + str(v[1]))
            print("This corresponds to url: " + mappings[revert_to_old_mapping(v[0])])

def forward_step_to_meaningful_bucket(model, seq, max_len = 1000, max_forward_step = 35, meaningful_buckets = [1, 2]):
    forward_step = 1
    while forward_step <= max_forward_step:
        if len(seq) >= max_len:
            seq = seq[len(seq)-max_len:]
        softmax_results = query_model(model, seq, using_y_time = True)
        if softmax_results == -1:
            print("query_model returned -1")
            return -1
        bucketed_results = convert_softmax_output_to_best_time_bucket(softmax_results)
        top_bucket_result = max(bucketed_results, key=lambda key: bucketed_results[key][1]) #returns most likely time bucket
        associated_p = bucketed_results[top_bucket_result][1]
        best_index = bucketed_results[top_bucket_result][0]
        if top_bucket_result in meaningful_buckets:
            return (revert_to_old_mapping(best_index), top_bucket_result, forward_step)
        else:
            forward_step += 1
            seq.append((revert_to_old_mapping(best_index), top_bucket_result)) #Adds the most recent prediction to the sequence input to query the model again
    print(forward_step, seq)
    print("WARNING: Exceeded maximum forward steps, did not find a meaningful time bucket, returning -1")
    return -1
