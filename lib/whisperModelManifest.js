const MODEL_ID = 'Xenova/whisper-small';
const MODEL_REVISION = '2d67713f236afa48a18992566e7647f6ca848e13';

const FILE_MANIFEST = Object.freeze({
  'added_tokens.json': { size: 2082, sha256: 'ce949fe720c14311cb6c446e69cfe340dc669d7b006077a6feed6ae571dd7e88' },
  'config.json': { size: 2232, sha256: '5a6429d21d7a3379dd0861b74510f9f7076f32b563bffc9fcb072482d55ab3be' },
  'generation_config.json': { size: 3837, sha256: '0b7407a4e53a677f826e03c75d409e6f830663932bf43dda3b08c5efa2223279' },
  'merges.txt': { size: 493869, sha256: '2df2990a395e35e8dfbc7511e08c12d56018d8d04691e0133e5d63b21e154dc6' },
  'normalizer.json': { size: 52666, sha256: 'bf1c507dc8724ca9cf9903640dacfb69dae2f00edee4f21ceba106a7392f26dd' },
  'onnx/decoder_model_merged_quantized.onnx': { size: 156780950, sha256: 'fcfc6100dc7339e7507e10f8b274350be7c4f8d8b575f0293f94cc0e156d6d24' },
  'onnx/encoder_model_quantized.onnx': { size: 92324809, sha256: '969f5ac12974340386bf7a02ea6626003e5e2dee396ffc6ab0eec282bf55ba06' },
  'preprocessor_config.json': { size: 339, sha256: 'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d' },
  'tokenizer.json': { size: 2480466, sha256: '27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566' },
  'tokenizer_config.json': { size: 282683, sha256: '2a4c4281cf9f51ac6ccc406fdc711a087afe6530f671fa7b80953edc498275ce' },
});

module.exports = { FILE_MANIFEST, MODEL_ID, MODEL_REVISION };
