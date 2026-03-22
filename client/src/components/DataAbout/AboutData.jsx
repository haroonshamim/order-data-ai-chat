import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import './AboutData.css';

//First We declare a React functional component called AboutData. 
const API_URL= process.env.REACT_APP_API_DATA;
console.log('[AboutData] API URL:', API_URL, 'NODE_ENV:', process.env.NODE_ENV);

const AboutData = () => {
  const [Data, setData] = useState([]);
  const [loading, setloading] = useState(true);
  //This will be used to navigate back to the main page when the user clicks the back button. useNavigate is a hook provided by react-router-dom that allows us to programmatically navigate to different routes in our application. In this case, we will use it to go back to the previous page when the user clicks the back button.
  const navigate = useNavigate();

  //I have added this into Useeffect so that it will only run once when the component is mounted. If I put it outside of useEffect, it will run on every render, which will cause an infinite loop because setData and setloading will trigger a re-render, which will call fetchData again, and so on.
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
  }, []);//No Dependency. The empty dependency array [] means this effect will only run once when the component mounts, preventing infinite loops.

  if (loading) return <div className="chat-header"><h1 className="loading-text">Loading...</h1></div>;
  if (!Data.length) return <div>No data found.</div>;
  const columns = Data[0] ? Object.keys(Data[0]) : [];
  return (
    <div>
      <button onClick={() => navigate('/')} className="about-link">← Back</button>
      <TableComponent columns={columns} Data={Data} />
    </div>
  );
};
// TableComponent moved out for clarity
const TableComponent = ({ columns, Data }) => {
  return (
    <div className="about-container">
      <h1 className="about-title">About Data</h1>
      <table className="about-table">
        <thead className="about-thead">
          <tr>
            {columns.map((col) => (
              <th key={col} className="about-th">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Data.map((row, index) => (
            <tr key={index} className="about-row">
              {columns.map((col) => (
                <td key={col} className="about-td">{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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