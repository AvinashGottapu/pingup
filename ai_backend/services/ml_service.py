import tensorflow as tf

MAX_WORDS = 100000

model = tf.keras.models.load_model(
    "services/Toxicity_Comment_Detector.keras"
)

vectorizer = tf.keras.layers.TextVectorization(
    max_tokens=MAX_WORDS,
    output_sequence_length=200,
    output_mode="int"
)

with open("services/vocab.txt", "r", encoding="utf-8") as f:
    vocab = [line.rstrip("\n") for line in f]

vectorizer.set_vocabulary(vocab)
    
def check_toxicity(comment: str):
    vectorized_comment = vectorizer([comment])
    prediction = model.predict(vectorized_comment)[0]
    
    return bool(prediction[0] > 0.4)