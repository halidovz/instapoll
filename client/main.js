import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import Fingerprint from 'meteor/szchenghuang:fingerprint';

import './main.html';

var pollTypes = [{'name': 'стандартный опрос', type: 0}];

Router.route('/', function () {
  this.render('main');
});

Router.route('/qrcode', {
	data: function() {
		return Polls.findOne({privateId: Session.get('currentPoll')});
	}
});

Router.route('/admin/:poll', {
	waitOn: function() {
    return Meteor.subscribe('poll', Session.get('currentPoll'));
  },
  data: function() {
    var pollId = this.params.poll;
    Session.set('currentPoll', pollId);

    var poll = Polls.findOne({privateId: pollId});
    if(poll && poll.questions) {
      _.forEach(poll.questions, function(q, index) {
        q.index = index;
        q.answersLimits = [{limit: 1, parent: q}, {limit: 3, parent: q}];
        q.variants && _.forEach(q.variants, function(v, i) {
          v.parent = q;
          v.index = i;
          if(q.right == v.id)
            v.right = true;
        })
        q.participants && _.forEach(q.participants, function(p, i) {
          p.parent = q;
          p.index = i;
        })
      })
    }
    if(poll) {
      poll.types = pollTypes.map(function(t) { return {type: t.type, name: t.name}});
      if(!poll.type)
        poll.type = 0;
      _.forEach(poll.types, function(t, i) {
        if(poll.type == t.type) {
          t.selected = 1;
          poll.typeName = t.name;
        }
      })
      return poll;
    }
  },
  template: 'admin'
});

Router.route('/play', {
  data: function() {

    var poll = Polls.findOne({privateId: Session.get('currentPoll')});
    
    if(poll) {
      if(!poll.type)
        poll.type = 0;
      poll.question = poll.questions[poll.currentQ];
      if(poll.question.variants) {
        poll.allCount = 0;

        _.forEach(poll.question.variants, function(v) {
          v.count = 0;
          if(poll.question.answers) {
            _.forEach(poll.question.answers, function(a) {
              if(a.indexOf(v.id) >= 0) {
                v.count++;
                poll.allCount++;
              }
            })
          }
        })

      }
      poll.currentQ++;

      var online = Presences.find();
      poll.watchersCount = online.count();
    }
    return poll;
  },
  template: 'play'
});

Router.route('/open/:poll', {
	waitOn: function() {
    return Meteor.subscribe('poll', Session.get('openedPoll'));
  },
  data: function() {
  	var fp = Fingerprint.get();
    var pollId = this.params.poll;
    Session.set('openedPoll', pollId);

    var poll = Polls.findOne({openId: pollId});
    if(poll && poll.questions) {
      poll.question = poll.questions[0];
      poll.question.variants && _.forEach(poll.question.variants, function(v, i) {
        v.parent = poll.question;
        if(poll.question.answers && poll.question.answers[poll.type == 1 ? Session.get('md5Participant') : fp.hash].indexOf(v.id) >= 0 )
          v.selected = true
      })
    }
    return poll;
  },
  template: 'open'
});

Template.error.helpers({
  errorMessage: function() {
    return Session.get('error');
  }
})

Router.configure({
  layoutTemplate: 'layout',
  loadingTemplate: 'loading',
});

var displayError = (function() {
  var timeout;
  return function(err) {
    if(err) {
      clearTimeout(timeout);
      Session.set('error', err.message);
      timeout = setTimeout(function() {
        Session.set('error', '');
      }, 3000);
      return true;
    }
    return false;
  }
})()

Template.main.events({
	'submit .new-poll': function(e) {
	  Meteor.call('createPoll', e.target.name.value, function(err, r) {
	    if(displayError(err))
	      return;
	    Router.go('/admin/'+r);
	    e.target.reset();
	  });
	  return false;
	},
	'submit .edit-poll': function(e) {
	  Router.go('/admin/'+e.target.poll.value);
	  return false;
	},
	'submit .open-poll': function(e) {
	  Router.go('/open/'+e.target.poll.value);
	  return false;
	},
	'submit form': function() {
		$('.modal').modal('hide');
	}
});

Template.admin.events({
  'click .add-q': function(e) {
    Meteor.call('addQuestion', Session.get('currentPoll'));
    return false;
  },
  'click .add-p': function(e) {
    Meteor.call('addParticipant', Session.get('currentPoll'));
    return false;
  },
  'click .remove-q': function(e) {
    Meteor.call('removeQuestion', Session.get('currentPoll'), {id: this.id});
    return false;
  },
  'click .remove-p': function(e) {
    Meteor.call('removeParticipant', Session.get('currentPoll'), {id: this.id});
    return false;
  },
  'click .add-v': function(e) {
    Meteor.call('addVariant', Session.get('currentPoll'), this.id);
  },
  'blur .poll-name': function(e) {
    Meteor.call('changePoll', Session.get('currentPoll'), {name: e.target.value});
  },
  'blur .open-id': function(e) {
    Meteor.call('changePoll', Session.get('currentPoll'), {openId: e.target.value});
  },
  'click .answers-limit': function(e) {
    Meteor.call('changeQuestion', Session.get('currentPoll'), this.parent.id, {answersLimit: this.limit});
  },
  'blur .q-name': function(e) {
    Meteor.call('changeQuestion', Session.get('currentPoll'), this.id, {name: e.target.value});
  },
  'click .poll-type': function(e) {
    Meteor.call('changeType', Session.get('currentPoll'), this.type);
  },
  'blur .v-name': function(e) {
    Meteor.call('changeVariant', Session.get('currentPoll'), this.id, this.index, {name: e.target.value});
  },
  'blur .p-name': function(e) {
    Meteor.call('changeParticipant', Session.get('currentPoll'), this.id, {name: e.target.value});
  },
  'click .right-v': function(e, template) {
    Meteor.call('rightVariant', Session.get('currentPoll'), this.parent.id, this.id);
  },
  'click .remove-v': function(e, template) {
    Meteor.call('removeVariant', Session.get('currentPoll'), this.parent.id, {id: this.id});
  },
  'click .play': function() {
    Meteor.call('switchQuestion', Session.get('currentPoll'), 0);
    Router.go('/play');
  },
  'click .qrcode': function() {
    Router.go('/qrcode');
  },
  'click .clear': function() {
    Meteor.call('clear', Session.get('currentPoll'));
  }
});

Template.play.events({
  'click .switch-q': function(e) {
    Meteor.call('switchQuestion', Session.get('currentPoll'), +e.target.dataset.direction);
  }
});

Template.open.events({
  'click .variant': function(e) {
  	var fp = Fingerprint.get();
    Meteor.call('selectVariant', Session.get('openedPoll'), this.parent.id, this.id, fp.hash);
  }
})

Tracker.autorun(function() {
  var currentPoll, openedPoll;
  if(currentPoll = Session.get('currentPoll')) {
    Meteor.subscribe('poll', currentPoll);
    var pollInfo = Polls.findOne({privateId: currentPoll});
    if(pollInfo) {
      Meteor.subscribe('pollWatchers', pollInfo.openId);
    }
  }
  if(openedPoll = Session.get('openedPoll')) {
    Meteor.subscribe('openPoll', openedPoll);
  }
});

Presence.state = function() {
  return {
    poll: Session.get('openedPoll')
  };
}

Fingerprint.compute();

Template.registerHelper('percent', function(one, two) {
  return (!two ? 0 : (one*100/two)).toFixed(2);
});

Template.registerHelper('equals', function (a, b) {
	return a === b;
});

Template.registerHelper('or',(a,b)=>{
  return a || b;
});
