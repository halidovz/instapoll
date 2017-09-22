import { Meteor } from 'meteor/meteor';

Meteor.startup(() => {
  Accounts.removeOldGuests();

  Meteor.publish("poll", function (poll) {
    return Polls.find({privateId: poll});
  });

  Meteor.publish("pollWatchers", function (poll) {
    var fields = {};
    fields['state.poll'] = poll;
    return Presences.find(fields);
  });

  Meteor.publishComposite('openPoll', function(poll) {
    return {
      find: function() {
        return Polls.find({openId: poll}, {fields: {privateId: 0, questions: 0}});
      },
      children: [
        {
          find: function(pollInfo) {
            return Polls.find({openId: poll}, {fields: {privateId: 0, 'questions.right': 0, questions: {$slice: [pollInfo.currentQ, 1]}}})
          }
        }
      ]
    }
  });
});
