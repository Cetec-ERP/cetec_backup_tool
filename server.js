const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = 3001;

app.get("/api/data", async (req, res) => {
  try {
    // const response = await axios.get(process.env.API_URL, {
    //   headers: {
    //     Authorization: `Bearer ${process.env.API_TOKEN}`,
    //     Access-Control-Allow-Origin: http://localhost:5173/,
    //   },
    // });
    const settings = {
      "async": true,
      "crossDomain": true,
      "url": "http://4-19-fifo.cetecerpdevel.com/api/customer/2?preshared_token=....",
      "method": "GET",
      "headers": {}
    };

    // const response = await axios.get(process.env.API_URL, {
    // });
    $.ajax(settings).done(function (response) {
      console.log(response);
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Error fetching data");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
