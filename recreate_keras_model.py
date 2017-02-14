import keras
from keras.models import load_model
import numpy as np
import datetime
from keras.preprocessing import sequence
from keras.optimizers import SGD, RMSprop, Adagrad
from keras.utils import np_utils
from keras.models import Sequential
from keras.layers.core import Dense, Dropout, Activation, TimeDistributedDense
from keras.layers.embeddings import Embedding
from keras.layers.recurrent import LSTM, GRU
from keras.layers.wrappers import TimeDistributed
import csv

from keras.layers import Input, Merge, merge
from keras.models import Model

def construct_model(e_size, hidden_size, layers, lrate, opt, vocab_size):
    e_size = e_size
    HIDDEN_SIZE = hidden_size
    LAYERS = layers
    lrate = lrate
    normalize = False
    y_vocab_size = (vocab_size - 1) * 4 + 1

    main_input = Input(shape=(None,),name = 'main_input', dtype='int32')
    x = Embedding(output_dim = e_size, input_dim = vocab_size+1, mask_zero = True)(main_input)
    if normalize:
        time_dim = 2
    else:
        time_dim = 4
    time_input = Input(shape=(None, time_dim), name = 'time component')
    x = merge([x, time_input], mode='concat')
    for i in range(LAYERS):
        x = LSTM(hidden_size, dropout_W = 0.2, return_sequences = True)(x)
    main_loss = TimeDistributed(Dense(y_vocab_size, activation='softmax'))(x)
    model = Model(input=[main_input, time_input], output=[main_loss])
    opt = RMSprop(lr = lrate)
    model.compile(loss='categorical_crossentropy', optimizer=opt, metrics=['accuracy'])
    o = 'rmsprop'
    modelname = "mergemodel_directvertical_modelweights_"+str(LAYERS)+'_'+str(HIDDEN_SIZE)+'_'+str(lrate)+'_'+str(e_size)+'_'+o+'_'
    return model, modelname

def load_saved_weights(layers, hidden_size, lrate, e_size, opt, batch_size, epoch, folder, filenamestart, vocab_size, onlyweights = True, oldstyle = True, hardcodefile = False):
    weightname = folder + filenamestart + '_' + str(layers) + '_' + str(hidden_size) + '_' + str(lrate) + '_' + str(e_size) + '_' + str(opt) + '_' + str(batch_size) + '_' + str(epoch)
    if oldstyle:
        model, modelname = construct_model(e_size, hidden_size, layers, lrate, opt, vocab_size)
        if hardcodefile:
            model.load_weights(hardcodefile)
        else:
            model.load_weights(weightname)
    else:
        model = load_model(weightname+'.h5')
    return model
