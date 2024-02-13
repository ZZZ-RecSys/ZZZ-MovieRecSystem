const fs = require("fs");
require('@tensorflow/tfjs-node');
require('dotenv').config();
const use = require('@tensorflow-models/universal-sentence-encoder');
const moviePlots = require("./data/movie-plots.json");

const config = {
    user: process.env.PG_NAME,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: "defaultdb",
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync('./ca.pem').toString(),
    },
};

const pgp = require('pg-promise')({
    capSQL: true // capitalize all generated SQL
});
const db = pgp(config);

const storeInPG = async (moviePlots) => {
    const columns = new pgp.helpers.ColumnSet(['title', 'director', 'plot', 'year', 'wiki', 'cast', 'genre', 'embedding'], {table: 'movie_plots'});
 
    const values = [];
    for(let i = 0; i < moviePlots.length; i++) {
       values.push({
          title: moviePlots[i]['Title'],
          director: moviePlots[i]['Director'],
          plot: moviePlots[i]['Plot'],
          year: moviePlots[i]['Release Year'],
          cast: moviePlots[i]['Cast'],
          genre: moviePlots[i]['Genre'],
          wiki: moviePlots[i]['Wiki Page'],
          embedding: `[${moviePlots[i]['embedding']}]`
       })
    }
 
    const query = pgp.helpers.insert(values, columns);
    await db.none(query);
 }

 use.load().then(async model => {
   const batchSize = 1000;
   for (let start = 0; start < moviePlots.length; start += batchSize) {
      const end = Math.min(start + batchSize, moviePlots.length);
      console.log(`Processing items from ${start} till ${end}.`);
      const movieBatch = moviePlots.slice(start, end);
      const plotDescriptions = movieBatch.map(plot => plot['Plot']);
      const embeddingsRequest = await model.embed(plotDescriptions);
      const embeddings = embeddingsRequest.arraySync();

      for (let i = 0; i < movieBatch.length; i++) {
         movieBatch[i]['embedding'] = embeddings[i];
      }
      await storeInPG(movieBatch);
   }
});