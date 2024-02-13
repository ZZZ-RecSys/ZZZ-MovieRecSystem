const fs = require("fs");
require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const moviePlots = require("./data/movie-plots.json");

use.load().then(async model => {
    const sampleMoviePlot = moviePlots[0];
    const embeddings = await model.embed(sampleMoviePlot['Plot']);
    console.log(embeddings.arraySync());
});