const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require("body-parser");
const ejs = require("ejs");

const keytracker = express();
keytracker.use(express.static("static"));

var db;

keytracker.use(session({
    resave: false,
    saveUninitialized: false,
    secret: "baca0a5394eb4604a9899821e12322c9d2054a660c3d963815d6ae2c31d865f3f83f235c0256179021987647b791a660dc7b84002a65605c35e42260d9ea4556"
}));

keytracker.use(bodyParser.urlencoded({
    extended: true
}));

MongoClient.connect("mongodb://localhost:27017/keys", {useNewUrlParser: true}, function (err, client) {
     if(err) throw err;
     db = client.db('keys');
     keytracker.listen(8080);
     console.log("Listening on port 8080...");
});

keytracker.set("view engine", "ejs");

// Functions used throughout the app
function isLoggedIn(req) {
    //console.log(req.session.currentUser);

    db.collection("users").findOne({"username": req.session.currentUser}, function(err, result) {
        if (!result) {
            req.session.currentUser = null;
        }
    });

    return typeof req.session.currentUser !== "undefined"
            && req.session.currentUser !== null;
}

function doIfLoggedIn(req, res, callback) {
    if (isLoggedIn(req)) {
        callback(req, res);
    } else {
        res.redirect("/login");
    }
}

function showError(req, res, message, title, link, linkName) {
    res.render("error", {
        pageName: title,
        currentUser: req.session.currentUser,
        errMsg: message,
        returnLink:{
            name:linkName,
            url:link
        }
    });
}

// MAIN FUNCTIONALITY //
keytracker.get("/", function(req, res) {
    //console.log("Accessed /");

    doIfLoggedIn(req, res, function(req, res) {
        var findObj = {};

        if (typeof req.query.search !== "undefined" && req.query.search !== null) {
            findObj = {"id": req.query.search};
        }

        db.collection("keys").find(findObj).toArray(function(err, result) {
            res.render("main", {
                pageName: "Main Page",
                currentUser: req.session.currentUser,
                keys: result
            });
        });
    });
});

keytracker.get("/fobs", function(req, res) {
    //console.log("Accessed /");

    doIfLoggedIn(req, res, function(req, res) {
        var findObj = {};

        if (typeof req.query.search !== "undefined" && req.query.search !== null) {
            findObj = {"id": req.query.search};
        }

        db.collection("fobs").find(findObj).toArray(function(err, result) {
            res.render("fobs", {
                pageName: "Key fobs",
                currentUser: req.session.currentUser,
                fobs: result,
            });
        });
    });
});

keytracker.get("/log", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("log").find({}).toArray(function(err, result) {
            res.render("log", {
                pageName: "Log",
                currentUser: req.session.currentUser,
                log: result
            });
        });
    });
});

keytracker.get("/users", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("users").find({}).toArray(function(err, result) {
            if (err) throw err;

            const users = result;

            db.collection("users").findOne({username: req.session.currentUser}, function(err, result) {
                if (err) throw err;

                res.render("users", {
                    pageName: "Users",
                    currentUser: result.username,
                    privilege: result.privilege,
                    users: users
                });
            });
        });
    });
});

// LOGIN //
keytracker.get("/login", function(req, res) {
    //console.log("Accessed /login");

    db.collection("users").countDocuments(function(err, result) {
        if (err) throw err;

        if (result == 0) {
            res.redirect("/config/setup");
        } else {
            if (isLoggedIn(req)) {
                res.redirect("/");
            } else {
                res.render("login", {pageName: "Log in"});
            }
        }
    });
});

// KEY FORMS //
keytracker.get("/keys/add", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        res.render("keys/add", {
            pageName: "Add new key",
            currentUser: req.session.currentUser
        });
    });
});

keytracker.get("/keys/add-fob", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        res.render("keys/add-fob", {
            pageName: "Add new key fob",
            currentUser: req.session.currentUser
        });
    });
});

keytracker.get("/keys/del-fob", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("fobs").findOne({id: req.query.id}, function(err, result) {
            if (err) throw err;

            if (result) {
                res.render("keys/del-fob", {
                    pageName: "Delete fob: " + result.id,
                    currentUser: req.session.currentUser,
                    fob: result
                });
            } else {
                showError(req, res, "This fob was not found in the system.", "Error", "/fobs", "the fobs page");
            }
        });
    });
});

keytracker.get("/keys/view", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("keys").findOne({id: req.query.id}, function(err, result) {
            if (err) throw err;

            var key = result;

            if (result) {
                db.collection("allocations").find({"key-id": req.query.id}).toArray(function(err, result) {
                    if (err) throw err;

                    res.render("keys/view", {
                        pageName: "Key Information for " + key.id,
                        currentUser: req.session.currentUser,
                        key: key,
                        allocations: result
                    });
                });
            } else {
                showError(req, res, "This key was not found in the system.", "Error", "/", "the main page");
            }
        });
    });
});

keytracker.get("/keys/check-out", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("keys").findOne({id: req.query.id}, function(err, result) {
            if (err) throw err;

            if (result) {
                res.render("keys/check-out", {
                    pageName: "Check out key: " + result.id,
                    currentUser: req.session.currentUser,
                    key: result
                });
            } else {
                showError(req, res, "This key was not found in the system.", "Error", "/", "the main page");
            }
        });
    });
});

keytracker.get("/keys/check-in", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("keys").findOne({id: req.query.id}, function(err, result) {
            if (err) throw err;

            if (result) {
                res.render("keys/check-in", {
                    pageName: "Check in key: " + result.id,
                    currentUser: req.session.currentUser,
                    key: result,
                    allocation: req.query
                });
            } else {
                showError(req, res, "This key was not found in the system.", "Error", "/", "the main page");
            }
        });
    });
});

// CONFIGURATION //
keytracker.get("/config/user", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        var user = req.query.username;

        if (user == null || user == "") {
            res.redirect("/error");
        } else {
            db.collection("users").findOne({username: user}, function(err, result) {
                res.render("config/user", {
                    pageName: "Configure user: " + user,
                    currentUser: req.session.currentUser,
                    user: result
                });
            });
        }
    });
});

keytracker.get("/config/add-user", function(req, res) {
    //console.log("Accessed /config/add-user");

    db.collection("users").findOne({}, function(err, result) {
        const userExists = result;

        if (!userExists || isLoggedIn(req)) {
            db.collection("users").findOne({username: req.session.currentUser, privilege: "owner"}, function(err, result) {
                if (err) throw err;

                if (result) {
                    res.render("config/add-user", {
                        pageName: "Add user",
                        currentUser: req.session.currentUser
                    });
                } else {
                    showError(req, res, "Only owners are permitted to add users.", "Privilege error", "/users", "the users page");
                }
            });
        } else {
            res.redirect("/");
        }
    });

});

keytracker.get("/config/setup", function(req, res) {
    //console.log("Accessed /config/setup");

    db.collection("users").countDocuments(function(err, result) {
        if (err) throw err;

        // If there are any registered users, redirect away from this page.
        if (result > 0) {
            res.redirect("/");
        } else {
            res.render("config/setup", {pageName: "Initial setup"});
        }
    });
});

// ACTIONS (preceded with /action/) //
keytracker.post("/action/login", function(req, res) {
    //console.log("json=" + JSON.stringify(req.body));

    //console.log("uname=" + req.body.username);
    //console.log("pwd=" + req.body.password);

    db.collection("users").findOne({"username": req.body.username}, function(err, result) {
        if (result) {
            const hash = crypto.createHash("sha512");
            const salt = result.salt;

            hash.update(req.body.password + salt);
            var generatedPasshash = hash.digest("hex")

            if (generatedPasshash == result.passhash) {
                req.session.currentUser = result.username;
            }

            res.redirect("/");
        } else {
            res.redirect("/login");
        }
    });
});

keytracker.get("/action/logout", function(req, res) {
    req.session.currentUser = null;
    res.redirect("/login");
});

keytracker.post("/action/add-key", function(req, res) {
    //check we are logged in
    //if(!req.session.loggedin){res.redirect('/login');return;}
    //we create the data string from the form components that have been passed in

    doIfLoggedIn(req, res, function(req, res) {
        var dataToStore = {
            "id":req.body.id,
            "type":req.body.type,
            "location":req.body.location,
            "storage":req.body.storage,
            "quantity":parseInt(req.body.quantity),
            "allocations":0
        }

        db.collection("keys").findOne({id: req.body.id}, function(err, result) {
            if (isNaN(dataToStore.quantity)) {
                showError(req, res, "Quantity given is not a number.", "Add Key Error", "/keys/add", "the new key form.");
            } else if (result) {
                showError(req, res, "Key ID '" + req.body.id + "' already exists in the database.", "/keys/add", "the new key form");
            } else if (dataToStore.quantity <= 0) {
                showError(req, res, "Insufficient quantity, at least 1 required.", "Add Key Error", "/keys/add", "the new key form");
            } else {
                //once created we just run the data string against the database and all our new data will be saved/
                db.collection('keys').insertOne(dataToStore, function(err, result) {
                    if (err) throw err;

                    //console.log('saved to database');
                    //when complete redirect to the login page
                    res.redirect('/');
                });
            }
        });
    });
});

keytracker.post("/action/add-user", function(req, res) {
    db.collection("users").findOne({}, function(err, result) {
        const userExists = result;

        db.collection("users").countDocuments(function(err, result) {
            if (result > 0 && !isLoggedIn(req)) {
                showError(req, res, "Only owners are permitted to add users.", "Privilege error", "/config/user?username=" + req.body.username, "the user configuration page");
            } else {
                // Get the number of users to calculate the new user's ID
                db.collection("users").countDocuments(function(err, result) {
                    if (err) throw err;

                    var numberOfUsers = result; // store the result in a descriptive variable

                    // 128 securely random bytes for the salt
                    crypto.randomBytes(128, function(err, result) {
                        if (err) throw err;

                        const hash = crypto.createHash("sha512");
                        const salt = result.toString("hex");

                        // Generate the hashed password
                        hash.update(req.body.password + salt);

                        var dataToStore = {
                            "username": req.body.username,
                            "privilege": req.body.privilege,
                            "passhash": hash.digest().toString("hex"),
                            "salt": salt.toString("hex")
                        };

                        db.collection("users").findOne({username: dataToStore.username}, function(err, result){
                            if (!result) {
                                db.collection("users").insertOne(dataToStore, function(err, result) {
                                    if (err) throw err;

                                    res.redirect("/");
                                });
                            } else {
                                showError(req, res, "User '" + result.username + "' already exists in the system.", "Privilege error", "/config/add-user", "the Add User form");
                            }
                        });
                    });
                });
            }
        });
    });
});

// Action to check in key
keytracker.post("/action/check-in", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("allocations").findOne({"key-id": req.body.keyId, "allocatee": req.body.allocatee}, function(err, result) {
            if (err) throw err;

            if (result) {
                db.collection("allocations").countDocuments({"key-id": req.body.keyId, "allocatee": req.body.allocatee}, function(err, result) {
                    db.collection("allocations").deleteMany({"key-id": req.body.keyId, "allocatee": req.body.allocatee});

                    db.collection("keys").updateOne({"id": req.body.keyId}, {
                        "$inc":{
                            "allocations": result * (-1)
                        }
                    }, function(err, result) {
                        if (err) throw err;

                        var currentTime = new Date();

                        var logData = {
                            "id": req.body.keyId,
                            "action": "Checked in",
                            "keyholder": req.body.allocatee,
                            "user": req.session.currentUser,
                            "timestamp":{
                                "year": currentTime.getYear(),
                                "month": currentTime.getMonth(),
                                "day": currentTime.getDate(),
                                "hour": currentTime.getHours(),
                                "minute": currentTime.getMinutes(),
                                "second": currentTime.getSeconds()
                            }
                        };

                        db.collection("log").insertOne(logData, function(err, result) {
                            if (err) throw err;

                            res.redirect("/keys/view?id=" + req.body.keyId);
                        });
                    })
                });
            } else {
                showError(req, res, "This key is not checked out to this allocatee.", "Check in error", "/keys/check-in?id=" + req.body.keyId, "the check in page");
            }
        });
    });
});

// Action to check out key
keytracker.post("/action/check-out", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("allocations").findOne({"key-id": req.body.keyId, "allocatee": req.body.allocatee}, function(err, result) {
            if (err) throw err;

            if (!result) {
                db.collection("keys").findOne({"id": req.body.keyId}, function(err, result) {
                    if (result !== null && result.quantity > result.allocations) {
                        var currentTime = new Date();

                        var dataToStore = {
                            "key-id": req.body.keyId,
                            "allocatee": req.body.allocatee,
                            "timestamp":{
                                "year": currentTime.getYear(),
                                "month": currentTime.getMonth(),
                                "day": currentTime.getDate(),
                                "hour": currentTime.getHours(),
                                "minute": currentTime.getMinutes(),
                                "second": currentTime.getSeconds()
                            }
                        };

                        db.collection("allocations").insertOne(dataToStore, function(err, result) {
                            if (err) throw err;

                            db.collection("keys").updateOne({"id": req.body.keyId}, {
                                "$inc":{
                                    "allocations": 1
                                }
                            }, function(err, result) {
                                if (err) throw err;

                                var logData = {
                                    "id": req.body.keyId,
                                    "action": "Checked out",
                                    "keyholder": req.body.allocatee,
                                    "user": req.session.currentUser,
                                    "timestamp":{
                                        "year": currentTime.getYear(),
                                        "month": currentTime.getMonth(),
                                        "day": currentTime.getDate(),
                                        "hour": currentTime.getHours(),
                                        "minute": currentTime.getMinutes(),
                                        "second": currentTime.getSeconds()
                                    }
                                };

                                db.collection("log").insertOne(logData, function(err, result) {
                                    if (err) throw err;

                                    res.redirect("/keys/view?id=" + req.body.keyId);
                                });
                            });
                        });
                    } else {
                        showError(req, res, "All of these keys have been checked out", "Check out error", "/", "the main page");
                    }
                });
            } else {
                showError(req, res, "This key has already been allocated to this person.", "Check out error", "/keys/view?id=" + req.body.keyId, "the key page");
            }
        });
    });
});

// Action to add fob
keytracker.post("/action/add-fob", function(req, res) {
    //check we are logged in
    //if(!req.session.loggedin){res.redirect('/login');return;}
    //we create the data string from the form components that have been passed in

    doIfLoggedIn(req, res, function(req, res) {
        var dataToStore = {
            "id":req.body.id,
            "allocatee": req.body.allocatee
        };

        db.collection("fobs").findOne({id: req.body.id}, function(err, result) {
            if (result) {
                showError(req, res, "Key ID '" + req.body.id + "' already exists in the database.", "/keys/add", "the new key form");
            } else {
                //once created we just run the data string against the database and all our new data will be saved/
                db.collection('fobs').insertOne(dataToStore, function(err, result) {
                    if (err) throw err;

                    var currentTime = new Date();

                    var logData = {
                        "id": req.body.id,
                        "action": "Checked out fob",
                        "keyholder": req.body.allocatee,
                        "user": req.session.currentUser,
                        "timestamp":{
                            "year": currentTime.getYear(),
                            "month": currentTime.getMonth(),
                            "day": currentTime.getDate(),
                            "hour": currentTime.getHours(),
                            "minute": currentTime.getMinutes(),
                            "second": currentTime.getSeconds()
                        }
                    };

                    //console.log('saved to database');
                    //when complete redirect to the main page
                    db.collection("log").insertOne(logData, function(err, result) {
                        if (err) throw err;

                        res.redirect('/fobs');
                    });
                });
            }
        });
    });
});

// Action to delete fob
keytracker.post("/action/del-fob", function(req, res) {
    //check we are logged in
    //if(!req.session.loggedin){res.redirect('/login');return;}
    //we create the data string from the form components that have been passed in

    doIfLoggedIn(req, res, function(req, res) {
        db.collection("fobs").findOne({id: req.body.id}, function(err, result) {
            if (result) {
                db.collection("fobs").deleteMany({id: req.body.id}, function(err, result) {
                    if (err) throw err;

                    var currentTime = new Date();

                    var logData = {
                        "id": req.body.id,
                        "action": "Checked in fob",
                        "keyholder": req.body.allocatee,
                        "user": req.session.currentUser,
                        "timestamp":{
                            "year": currentTime.getYear(),
                            "month": currentTime.getMonth(),
                            "day": currentTime.getDate(),
                            "hour": currentTime.getHours(),
                            "minute": currentTime.getMinutes(),
                            "second": currentTime.getSeconds()
                        }
                    };

                    db.collection("log").insertOne(logData, function(err, result) {
                        if (err) throw err;

                        res.redirect("/fobs");
                    });
                });
            } else {
                showError(req, res, "This fob does not exist", "Fob remove error", "/fobs", "the key fob page");
            }
        });
    });
});

// Action to delete user
keytracker.post("/action/delete-user", function(req, res) {
    // Check if logged in
    doIfLoggedIn(req, res, function(req, res) {
        // Check if the current user is an owner
        db.collection("users").findOne({username: req.session.currentUser, privilege: "owner"}, function(err, result) {
            //console.log(req.body.username);

            if (err) throw err;

            // If the current user is an owner, delete the user and redirect
            if (result) {
                // Get the user to be deleted
                db.collection("users").findOne({username: req.body.username}, function(err, result) {
                    if (err) throw err;

                    const userToDelete = result;

                    // Count how many owners are left on the system, since there should always be at least one.
                    db.collection("users").countDocuments({privilege: "owner"}, function(err, result) {
                        if (err) throw err;

                        const numberOfOwners = result;

                        // If the user to delete is not an owner or there are more than 1 owners
                        if (numberOfOwners > 1 || userToDelete.privilege !== "owner") {
                            db.collection("users").deleteOne({"username": req.body.username}, function(err, result) {
                                if (err) throw err;

                                // If the user is deleting themselves, log them out.
                                if (req.body.username === req.session.currentUser) {
                                    req.session.currentUser = null;
                                }

                                res.redirect("/users");
                            });
                        } else if (numberOfOwners <= 1){
                            showError(req, res, "Cannot delete the sole owner of the database, please grant the position to another user first.", "Error", "/config/user?username=" + req.body.username, "the user configuration page");
                        } else {
                            showError(req, res, "Only owners can delete any users, including their own accounts.", "Privilege Error", "/config/user?username=" + req.body.username, "the user configuration page");
                        }
                    });
                });
            } else {
                // If the user does not have permissions, they may not delete accounts (including their own).
                showError(req, res, "Only owners are permitted to delete users.", "Privilege error", "/config/user?username=" + req.body.username, "the user configuration page");
            }
        });
    });
});

keytracker.post("/action/change-pass", function(req, res) {
    doIfLoggedIn(req, res, function(req, res) {
        db.collection("users").findOne({username: req.session.currentUser, privilege: "owner"}, function(err, result) {
            if (err) throw err;

            // The user is allowed to change only their own password if they are limited, and any password if they are an owner
            if (result || req.body.username == req.session.currentUser) {

                crypto.randomBytes(128, function(err, result) {
                    if (err) throw err;

                    const hash = crypto.createHash("sha512");
                    const salt = result.toString("hex");

                    // Generate the hashed password
                    hash.update(req.body.password + salt);

                    db.collection("users").updateOne({"username": req.body.username}, {
                        "$set":{
                            "passhash": hash.digest().toString("hex"),
                            "salt": salt.toString("hex")
                        }
                    });

                    res.redirect("/config/user?username=" + req.body.username);
                });
            } else {
                showError(req, res, "Only owners are permitted to change other users' passwords.", "Privilege error", "/config/user?username=" + req.body.username, "the user configuration page");
            }
        });
    });
});
