const express=require('express');
const router=express.Router();

router.get('/',(req,res)=>{
    res.send("This is test Route")
})
module.exports=router

/*

In CommonJS, module.exports = router; means:
That is why this works in server.js:
require('./routes/health') returns the router you exported, and then app.use(...) mounts it on /api/health.
So in simple terms:
router contains the route definitions in this file
module.exports = router makes that router available outside this file
server.js imports it and attaches it to the main app
Without that line, server.js would not receive the router from this file.

*/