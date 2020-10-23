var express = require('express');
var session = require('express-session')
const bcrypt = require('bcryptjs');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
const Student = require('./models/student')
var User = require('./models/user');
var MCQ = require('./models/mcq');
var Subject = require('./models/subject');
var local = require('passport-local');
var path = require('path');
const axios = require('axios');
var passportLocalMongoose = require('passport-local-mongoose');
const { serialize } = require('v8');
const flash= require('connect-flash');
const methodOverride = require('method-override');

mongoose.connect('mongodb://localhost:27017/mcq-test', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
});



var app = express();
app.use(methodOverride('_method'));
app.use(flash());
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")));
app.set('view engine', 'html');
app.engine('html', require('ejs').__express);
app.use(session({
    secret: 'Dead girl in the pool',
    saveUninitialized: true,
    duration: 30 * 60 * 1000,
    activeDuration: 30 * 60 * 1000,
    httpOnly: true,
    secure: true,
    ephemeral: true,
    resave: false,
    cookie: { maxAge: 60000 }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));


passport.use(new local(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//============================================
//                  Routes
//============================================
app.get('/', function (req, res) {
    res.render('entry');
});

//--------------------------------------------


//-------------------REGISTER--------------------------

app.get('/register_student', (req, res) => {
    res.render('register_student')
});

app.post('/register_student', (req, res) => {

    console.log(req.body.username)

    User.register(new User({
        username: req.body.username,
        branch: req.body.branch,
        year: req.body.year,
        type: 'student'

    }), req.body.password, function (err, user) {
        if (err) {
            console.log("in student registeration err");
            console.log(err);
            return res.redirect('/register_student');
        }
        passport.authenticate('local')(req, res, function () {
            res.redirect('/login_student');//to make
        });
    })
});

app.get('/register_teacher', function (req, res) {
    res.render('register_teacher')
});

app.post('/register_teacher', function (req, res) {
    req.body.username
    req.body.password

    User.register(new User({
        username: req.body.username,
        branch: req.body.branch,
        type: 'teacher'
    }), req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            return res.render('register_teacher');
        }
        passport.authenticate('local')(req, res, function () {
            res.redirect('/login_teacher');
        });
    });
});

//-----------------------LOGIN--------------------------
app.get('/login_teacher', function (req, res) {
    res.render('login_teacher');
});
app.get('/login_student', function (req, res) {
    res.render('login_student');
});

app.post('/login_teacher', passport.authenticate('local', {
    successRedirect: '/subject',
    failureRedirect: '/login_teacher'
}), function (req, res) {
});

app.post('/login_student', passport.authenticate('local', {
    successRedirect: '/subject',
    failureRedirect: '/login_student'
}), function (req, res) {

});
//---------------------------------------------------

app.get('/subject', isLoggedIn, function (req, res) {
   // console.log(req.user);
    //console.log("YE raha");
    if (req.user.type == "teacher") {
        User.findById(req.user._id).populate('subject').exec(function (err, user) {
            if (err) {
                console.log(err);
            } else {
                
                res.render('subjects', { subjects: user.subject, req: req });
            }
        });
    } else if (req.user.type == "student") {
        Subject.find({ branch: req.user.branch, year: req.user.year }).populate('subject').exec(function (err, subject) {
            if (err) {
                console.log(err);
            } else {
   
                res.render('subjects', { subjects: subject, req: req });

            }
        });

    }


});

app.get('/subject/newsub', function (req, res) {
    res.render('newsub')
});

app.post('/subject', function (req, res) {
    var subjectName = req.body.subjectName;
    var newSubject = {
        subjectName: subjectName,
        branch: req.body.branch,
        year: req.body.year,
        marks: req.body.totalMarks
    };
    Subject.create(newSubject, function (err, newSubject) {
        if (err) {
            console.log(err);
        } else {
     //       console.log("1" + req.user);
            req.user.subject.push(newSubject);
            req.user.save();
       //     console.log("2" + req.user);
         //   console.log(newSubject);
            res.redirect('/subject');
        }
    })
});



// ---------------------------------------------------

app.get('/quiz', isLoggedIn, function (req, res) {
    res.render('quiz');
});





 app.get('/subject/:id', isLoggedIn, function (req, res) {
    Subject.findById(req.params.id).populate('mcqs').exec(function (err, foundSubject) {
        if (err) {
            console.log(err);
        } else {
        //    console.log(foundSubject);
            res.render('mcq2', { subject: foundSubject })
        }
    })
});
 
 //NEED TO CHNAGE 'QuizUp'
app.get('/quizups/:id', isLoggedIn, function (req, res) {
    Subject.findById(req.params.id).populate('mcqs').exec(function (err, foundSubject) {
        if (err) {
            console.log(err);
        } else {
           // console.log(foundSubject);
            res.render('QuizUp2', { subject: foundSubject});
        }
    })
});


//NEED TO CHANGE 'quiz-maker'
app.get('/subject/:id/new', isLoggedIn, function (req, res) {
    Subject.findById(req.params.id, function (err, subject) {
        if (err) {
            console.log(err);
        } else {
            res.render('quiz-maker2.html', { subject: subject });
        }
    })
});



//FOR STUDENT PLAYING QUIZ THIS IS USE:

app.post('/quizups/:id', isLoggedIn, function (req, res) {
    console.log("HEELOOO");
    Subject.findById(req.params.id).populate('mcqs').exec(
        function (err, subject) {
            if (err) {
                console.log(err);
            } else {
                var marks = 0;
                var answers = req.body.answers;
                for (var i = 0; i < subject.mcqs.length; i++) {
                    if (subject.mcqs[i].answer == answers[i]) {
                        marks = marks + subject.mcqs[i].point;
                    }
                }
                console.log("rollno" + req.user.username);
                console.log("marks" + marks);
                var students_perf = {
                    username: req.user.username,
                    marks: marks
                };
                subject.performance.push(students_perf);
                subject.save();
                res.render('report',{subject:subject,req:req});
                console.log("HERE ");
                res.redirect('/subject');
            }
        }
    )
});






app.post('/subject/:id', function (req, res) {

    console.log("HELLLLLLLLL");
    Subject.findById(req.params.id, function (err, subject) {

        if (err) {
            console.log(err);
            res.redirect("/subject");
        } else {

            MCQ.create(req.body.Qset, function (err, mcq) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("ERRRORORO");
                    var Qset = req.body.Qset;

                    for (var i = 0; i < Qset.length; i++) {
                        subject.mcqs.push(mcq[i]);
                        console.log(mcq[i].point);
                    }
                    subject.save();
                    console.log("Redirect");
                    res.redirect('/subject');
                }
            });
        }
    });
});







// *******************DELETE ROUTE *********************

app.get('/subject/:id/del',isLoggedIn,function(req,res){
    console.log("HELLO");
    let searchQuery= {_id:req.params.id};
    
    Subject.deleteOne(searchQuery)
        .then(subject=>{
            req.flash('error_msg',"DELETED SUUCESSFULLY");
            res.redirect('/subject');
        })
        .catch(err=>{
            console.log(err);
            res.redirect('/subject');
        });
});

app.get('/delete/:id/mcq/:id2',isLoggedIn,function(req,res){
    let searchQuery={_id : req.params.id2};
    let id=req.params.id;

    MCQ.deleteOne(searchQuery)
       .then(mcq=>{
           res.redirect('/subject/'+id);
       })
       .catch(err=>{
           console.log(err);
           res.redirect('/subject/'+id);
       })
})

// **************************************************************

app.get('/edit/:id/mcq/:id2', isLoggedIn, function (req, res) {
    Subject.findById(req.params.id).populate('mcqs').exec(
        function(err,subject){
            if(err){
                console.log(err);
            }
            else{
                var id2=req.params.id2;
                for(var i=0;i<subject.mcqs.length;i++){
                    if(subject.mcqs[i]._id==id2){
                        res.render('edit',{mcq:subject.mcqs[i]});
                        break;
                    }
                }
            }
        }
    )});
app.get('/edit/:id', (req, res)=> {
        let searchQuery = {opt1 : req.params.id}
        console.log(req.body.subject);
        console.log(searchQuery);
        MCQ.findById(searchQuery, {$set: {
            question : req.body.question,
            opt1 : req.body.opt1,
            opt2 : req.body.opt2,
            opt3 : req.body.opt3,
            opt4 : req.body.opt4,
            answer : req.body.answer
        }})
        .then(mcq => {
            req.flash('success_msg', 'Employee data updated successfully.')
            res.redirect('/subject');
        })
        .catch(err => {
            req.flash('error_msg', 'ERROR: '+err)
            console.log(err);
            res.redirect('/subject');
        });
    });

// *****************************************************************8

//-----------------------------------------------

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}
// -----------------------------------------------------------

// -----------------------------------------------------

app.listen(8000, function (req, res) {
    console.log('Server is listening!');
});