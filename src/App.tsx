import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = import.meta.env.API_TOKEN;
    // const token = process.env.API_TOKEN;
    axios
      .get('http://4-19-fifo.cetecerpdevel.com/api/customer/2', {
        headers: {
          Authorization: `Bearer ${token}`, // Include the token in the Authorization header
        },
      }) // Assuming your API is running on port 3000
      .then((response) => {
        setData(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <h1>API Data Results</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Column 1</th>
              <th>Column 2</th>
              <th>Column 3</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.column1}</td>
                <td>{item.column2}</td>
                <td>{item.column3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
