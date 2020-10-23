var mongoose = require('mongoose');

var subjectSchema = new mongoose.Schema({
    subjectName: {
       type:String,
       unique:true,
       trim: true 
    },
    branch: String,
    year: String,
    performance: [
        {
            username: String,
            marks: Number
        }
    ],
    marks: Number,
    mcqs: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MCQ'
        }
    ]
});

module.exports = mongoose.model('Subject', subjectSchema);