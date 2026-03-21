import React,{useEffect,useState} from "react";
import axios from "axios";

//First We declare a React functional component called AboutData. 
const API_URL= process.env.REACT_APP_API_DATA;
const AboutData=()=>{ 
      //Declaring Data
      const [Data, setData] = useState([]);
      const [loading,setloading]=useState(true);

      //We are using fetch to get data from the API_URL and then we set the Data state with the response data. If there is an error, we log it to the console. Finally, we set loading to false in both cases to indicate that the data fetching process is complete.
  const fetchData = () => {
  axios.get(API_URL)
    .then((response)=>{
        setData(response.data);
        setloading(false);
    })
    .catch((error)=>{
        console.error('Error fetching data:', error);
        setloading(false);
    });
  };
  

    /*
        Here, the empty array [] means the effect will run only once, when the component mounts. If you put variables inside the array, the effect will re-run whenever those variables change. So:
        
        [] (empty): run once on mount.
        [someVar]: run on mount and whenever someVar changes.
        This helps control when your side effects (like fetching data) should happen.

    */
    useEffect(()=>{
        fetchData();
    }, []);

  if (loading) return <div>Loading...</div>;
  if (!Data.length) return <div>No data found.</div>;
    const columns = Data[0] ? Object.keys(Data[0]) : [];
    return(
            <div>
                <h1>About Data</h1>
                <table border="1" cellPadding="8">
                    <thead>
                        {columns.map((col) => (
                            <th key={col}>{col}</th>
                        ))}
                    </thead>
                    <tbody>
                        {Data.map((row, index) => (
                            <tr key={index}>
                                {columns.map((col) => (
                                    <td key={col}>{row[col]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>              
            </div>
  );
}
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