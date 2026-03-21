import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

//First We declare a React functional component called AboutData. 
const API_URL= process.env.REACT_APP_API_DATA;
console.log('[AboutData] API URL:', API_URL, 'NODE_ENV:', process.env.NODE_ENV);




// TableComponent moved out for clarity
const TableComponent = ({ columns, Data }) => {
  const styles = {
    container: {
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      padding: '20px',
      color: '#333',
    },
    title: {
      borderBottom: '2px solid #f4f4f4',
      paddingBottom: '10px',
      marginBottom: '20px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    },
    thead: {
      backgroundColor: '#007bff',
      color: '#ffffff',
      textAlign: 'left',
    },
    th: {
      padding: '12px 15px',
      fontWeight: '600',
      textTransform: 'uppercase',
      fontSize: '0.85rem',
      letterSpacing: '0.05em',
    },
    td: {
      padding: '12px 15px',
      borderBottom: '1px solid #dddddd',
    },
    row: {
      transition: 'background-color 0.2s ease',
    }
  };
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>About Data</h1>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            {columns.map((col) => (
              <th key={col} style={styles.th}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Data.map((row, index) => (
            <tr
              key={index}
              style={{
                ...styles.row,
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
              }}
            >
              {columns.map((col) => (
                <td key={col} style={styles.td}>{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AboutData = () => {
  const [Data, setData] = useState([]);
  const [loading, setloading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(API_URL)
      .then((response) => {
        if (Array.isArray(response.data.orders)) {
          setData(response.data.orders);
        } else {
          setData([]);
        }
        setloading(false);
      })
      .catch((error) => {
        setloading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!Data.length) return <div>No data found.</div>;
  const columns = Data[0] ? Object.keys(Data[0]) : [];
  return (
    <div>
      <button
        onClick={() => navigate(-1)}
       style={{ marginBottom: 24, padding: '6px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '14px' }}
      >
        ← Back
      </button>
      <TableComponent columns={columns} Data={Data} />
    </div>
  );
};

export default AboutData;

/*
Notes
-------------------------1------------------------  
The useEffect hook in React is a function that allows you to perform side effects in functional components. Side effects are operations that reach outside the React component tree, such as fetching data from an API, updating the browser's DOM, using timers, or managing event listeners and subscriptions


If there are no states (no useState or setState calls) in a component, the component will not re-render on its own after the initial render—unless:

Its parent component re-renders and passes new props, or
There is a context/provider update, or
A force update is triggered by some other means.
So, without state or prop changes, a functional component will render only once when mounted and will not run again by itself.


-------------------------2------------------------
If you remove useEffect and directly call fetchData() in your component body, fetchData will run on every render. This will cause an infinite loop:

fetchData updates state (setData, setloading)
State update triggers a re-render
fetchData runs again, causing another state update
This repeats endlessly, crashing your app
useEffect with an empty dependency array ensures fetchData runs only once after the initial render, preventing this loop.
Always use useEffect for side effects like data fetching in React functional components.
*/