import numpy as np
from rtlsdr import RtlSdr
import matplotlib.pyplot as plt

"""
This code implements a partial decoding of the Chamberlain Security+ 315 MHz OOK protocol.
The code is based on the following resources:
- https://github.com/argilo/secplus
"""

# Constants
SAMPLE_RATE = 2.4e6  # Sample rate of the SDR
FREQUENCY = 310e6  # Frequency of the OOK signal: 315 MHz
THRESHOLD = 0.5  # Threshold level for OOK demodulation

# Set up RTL-SDR
sdr = RtlSdr()
sdr.sample_rate = SAMPLE_RATE
sdr.center_freq = FREQUENCY
sdr.gain = 'auto'

_ORDER = {
    0b0000: (0, 2, 1),
    0b0001: (2, 0, 1),
    0b0010: (0, 1, 2),
    0b0100: (1, 2, 0),
    0b0101: (1, 0, 2),
    0b0110: (2, 1, 0),
    0b1000: (1, 2, 0),
    0b1001: (2, 1, 0),
    0b1010: (0, 1, 2),
}

_INVERT = {
    0b0000: (True, True, False),
    0b0001: (False, True, False),
    0b0010: (False, False, True),
    0b0100: (True, True, True),
    0b0101: (True, False, True),
    0b0110: (False, True, True),
    0b1000: (True, False, False),
    0b1001: (False, False, False),
    0b1010: (True, False, True),
}

payloads = []

"""
Decode a Security+ 2.0 transmission using two payloads.
"""
def decode_payloads(payloads):
    rolling1, fixed1, data1 = decode_payload(payloads[0])
    rolling2, fixed2, data2 = decode_payload(payloads[1])
    return combine_halves(rolling1, rolling2, fixed1, fixed2, data1, data2)

def decode_payload(code):
    packet_type = (code[0] << 1) | code[1]
    indicator = code[2:10]
    payload = code[10:]
    return decode_payload_parts(packet_type, indicator, payload)

def combine_halves(rolling1, rolling2, fixed1, fixed2, data1, data2):
    rolling = _decode_v2_rolling(rolling1, rolling2)
    fixed = int("".join(str(bit) for bit in fixed1 + fixed2), 2)
    if data1 is None:
        data = None
    else:
        data = int("".join(str(bit) for bit in data1 + data2), 2)
        _v2_check_parity(fixed, data)
    return rolling, fixed, data

def _decode_v2_rolling(rolling1, rolling2):
    rolling_digits = rolling2[8:] + rolling1[8:]
    rolling_digits += rolling2[4:8] + rolling1[4:8]
    rolling_digits += rolling2[:4] + rolling1[:4]

    rolling = 0
    for digit in rolling_digits:
        rolling = (rolling * 3) + digit
    if rolling >= 2**28:
        raise ValueError("Rolling code was not in expected range")
    return int(f"{rolling:028b}"[::-1], 2)

def _v2_check_parity(fixed, data):
    parity = (fixed >> 32) & 0xf
    for offset in range(0, 32, 4):
        parity ^= ((data >> offset) & 0xf)
    if parity != 0:
        raise ValueError("Parity bits are incorrect")
    
def decode_payload_parts(packet_type, indicator, payload):
    if packet_type == 0:
        payload_length = 30
    elif packet_type == 1:
        payload_length = 54
    elif packet_type == 2:
        raise ValueError("Unsupported packet type")
    else:
        raise ValueError("Invalid packet type")

    if len(payload) != payload_length:
        raise ValueError("Incorrect payload length: expected %d, got %d" % (payload_length, len(payload)))
    
    parts = _v2_unscramble(indicator, payload)

    rolling = []
    for i in range(0, len(indicator), 2):
        rolling.append((indicator[i] << 1) | indicator[i+1])
    for i in range(0, len(parts[2]), 2):
        rolling.append((parts[2][i] << 1) | parts[2][i+1])
    if 3 in rolling:
        raise ValueError("Illegal value for ternary bit")

    fixed = parts[0][:10] + parts[1][:10]

    if packet_type == 0:
        data = None
    elif packet_type == 1:
        if rolling[:4] != rolling[-4:]:
            raise ValueError("Last four ternary bits do not repeat first four")
        rolling = rolling[:-4]
        data = parts[0][10:] + parts[1][10:]

    return rolling, fixed, data

def _v2_unscramble(indicator, payload):
    try:
        order = _ORDER[(indicator[0] << 3) | (indicator[1] << 2) | (indicator[2] << 1) | indicator[3]]
        invert = _INVERT[(indicator[4] << 3) | (indicator[5] << 2) | (indicator[6] << 1) | indicator[7]]
    except KeyError:
        raise ValueError("Illegal value for ternary bit")

    parts_permuted = [payload[0::3], payload[1::3], payload[2::3]]
    for i in range(3):
        if invert[i]:
            parts_permuted[i] = [bit ^ 1 for bit in parts_permuted[i]]

    parts = [[], [], []]
    for i in range(3):
        parts[order[i]] = parts_permuted[i]

    return parts

# Wait for signal
signal_detected = False

while not signal_detected or True:
  # Capture samples from the SDR
  num_samples = 1024*2*2*2*2*2*2*2*2  # Adjust as needed
  samples = sdr.read_samples(num_samples)

  # print(samples[0:10])

  # Demodulation: Envelope Detection
  abs_samples = np.abs(samples)  # Rectify the samples
  smoothed_samples = np.convolve(abs_samples, np.ones(100)/100, mode='same')  # Apply smoothing filter

  # Thresholding
  demodulated_data = (smoothed_samples > THRESHOLD).astype(int)  # Compare against threshold and convert to binary values

  # Check if a peak is detected
  if sum(demodulated_data) > 0:
    signal_detected = True

    # print signal as "n 0s", "n 1s", etc
    last = demodulated_data[0]
    count = 0
    for i in range(0, len(demodulated_data)):
      if demodulated_data[i] != last:
        # print(str(count) + " " + str(last) + "s")
        count = 0
        last = demodulated_data[i]
      count += 1
    # print(str(count) + " " + str(last) + "s")


    # Find the bit widths between each transition
    # start = 0
    # for i in range(1, len(demodulated_data)):
    #   if demodulated_data[i] != demodulated_data[i-1]:
    #     print("Transition from " + str(demodulated_data[i-1]) + " to " + str(demodulated_data[i]) + " at index " + str(i))
    #     if start > 0:
    #       print("Bit width: " + str(i - start))
    #     start = i

    # remove leading zeros
    while demodulated_data[0] == 0:
      demodulated_data = demodulated_data[1:]
    # remove trailing zeros
    while demodulated_data[-1] == 0:
      demodulated_data = demodulated_data[:-1]

    BIT_WIDTH = 620

    # collapse the data into bits
    data = []
    for i in range(0, len(demodulated_data), BIT_WIDTH):
      # if most bits are 1, then the byte is 1
      if sum(demodulated_data[i:i+BIT_WIDTH]) > BIT_WIDTH / 2:
        data.append(1)
      else:
        data.append(0)

    if (len(data) < 30):
      continue

    preamble = data[:20]
    frame_id = data[20:22]
    payload = data[22:]

    # convert bits to bytes
    preamble_bytes = "".join([str(bit) for bit in preamble])
    preamble_bytes = hex(int(preamble_bytes, 2))

    # if preamble starts with 0xaaa
    if preamble_bytes.startswith("0xaaa"):
      payloads.append(payload)
      print("Payload: " + str(payload))
      if len(payloads) > 1:
        payloads = payloads[1:]
        decode_payloads(payloads)
      
      # Plotting the smoothed samples
      # plt.plot(smoothed_samples)
      # plt.title("Smoothed Samples")
      # plt.xlabel("Sample Index")
      # plt.ylabel("Amplitude")
      # plt.show()

      # Plotting the demodulated data
      # plt.plot(demodulated_data)
      # plt.title("Demodulated OOK Data")
      # plt.xlabel("Sample Index")
      # plt.ylabel("Binary Value")
      # plt.show()

# Clean up
sdr.close()
