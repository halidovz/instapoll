Polls = new Mongo.Collection("polls");

Meteor.methods({
   createPoll: function (name) {
    check(name, NonEmptyString);

    var poll =  Polls.insert({name: name, currentQ: 0});
    var md5 = CryptoJS.MD5(poll + Math.random()).toString().toUpperCase();

    var privateId = md5.substr(0,7);
    var openId = md5.substr(-7);
    Polls.update(poll, {$set: {privateId: privateId, openId: openId}});
    return privateId;
  },
  removePoll: function(poll) {
    Polls.remove(poll);
  },
  changePoll: function(poll, fields) {
    Polls.update({privateId: poll}, {$set: fields});
  },
  addQuestion: function(poll) {
    Polls.update({privateId: poll}, {$push: {questions: {id: Math.random(), answersLimit: 1, answers: {}}}}, true);
  },
  addParticipant: function(poll) {
    Polls.update({privateId: poll}, {$push: {participants: {id: Math.random() }}}, true);
  },
  removeQuestion: function(poll, q) {
    Polls.update({privateId: poll}, {$pull: {questions: q}});
  },
  removeParticipant: function(poll, p) {
    Polls.update({privateId: poll}, {$pull: {participants: p}});
  },
  changeQuestion: function(poll, q, fields) {
  	var update;
  	if (fields.name !== undefined) {
  		update = {'questions.$.name': fields.name };
  	} else if(fields.answersLimit !== undefined ){
  		update = {'questions.$.answersLimit': fields.answersLimit };
  	}
    Polls.update({privateId: poll, 'questions.id': q}, {$set: update });
  },
  addVariant: function(poll, q) {
    Polls.update({privateId: poll, 'questions.id': q}, {$push: {'questions.$.variants': {id: Math.random()} } }, true);
  },
  rightVariant: function(poll, q, v) {
    Polls.update({privateId: poll, 'questions.id': q }, {$set: { 'questions.$.right': v } });
  },
  removeVariant: function(poll, q, v) {
    Polls.update({privateId: poll, 'questions.id': q }, {$pull: {'questions.$.variants': v } });
  },
  'changeType': function(poll, type) {
    Polls.update({privateId: poll }, {$set: {type: type } });
  },
  changeVariant: function(poll, vId, vIndex, fields) {
    var update = {};
    update['questions.$.variants.'+vIndex+'.name'] = fields.name;
    Polls.update({privateId: poll, 'questions.variants.id': vId, }, {$set: update });
  },
  changeParticipant: function(poll, p, fields) {
    Polls.update({privateId: poll, 'participants.id': p}, {$set: {'participants.$.name': fields.name } });
  },
  switchQuestion: function(poll, direction) {
    var pollInfo = Polls.findOne({privateId: poll});
    var qLength = pollInfo.questions.length;
    var currentQ = pollInfo.currentQ;
    if(currentQ === undefined) 
      nextQ = 0;
    else {
      var nextQ = currentQ + direction;
      if(nextQ >= qLength)
        nextQ = 0;
      if(nextQ < 0)
        nextQ = qLength-1;
    }
    Polls.update({privateId: poll}, {$set: {currentQ: nextQ}});
  },
  selectVariant: function(poll, q, v, userId) {
    var update = {};
    var pollInfo = Polls.findOne({openId: poll});

    _.forEach(pollInfo.questions, function(question) {
    	if (question.id == q) {
    		var userAnswers = question.answers[userId];
    		if (userAnswers && userAnswers.length) {
				var index = userAnswers.indexOf(v);
    			if (index >= 0) {
    				userAnswers.splice(index, 1);
    				update['questions.$.answers.'+userId] = userAnswers;
    			} else if(userAnswers.length < question.answersLimit && question.answersLimit > 1) {
    				userAnswers.push(v);
    				update['questions.$.answers.'+userId] = userAnswers;
    			} else if (question.answersLimit == 1) {
    				update['questions.$.answers.'+userId] = [v];
    			}
    		} else {
				update['questions.$.answers.'+userId] = [v];
			}
    	}
    });
    update['dirty'] = true;
    Polls.update({openId: poll, 'questions.id': q }, {$set: update}, true);
  },
  clear: function(poll) {
    Polls.find({privateId: poll}).forEach(function(p) {
      p.questions && _.forEach(p.questions, function(q) {
        q.answers = {};
      })

      Polls.update({privateId: poll}, {$set: {questions: p.questions, dirty: false}});
    });
  }
});

NonEmptyString = Match.Where(function (x) {
  check(x, String);
  return x.length > 0;
});