const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

exports.playerPoints = functions.database
   .ref('days/{week}/games/{day}/score').onWrite(event =>{
        
           
            const data = event.data.val();
            const day = event.params.day;
            const week = event.params.week;
         
            // get user key from the USerProfile

            admin.database().ref('userProfile/').once('value').then(function(snapshots) {

                snapshots.forEach(function(snapshot){
            
                    let userKey = snapshot.key;

                    admin.database().ref(`bets/${userKey}/${week}/${day}`).once('value').then(function(snapshot){
                      
                       let betData = snapshot.val();

                       if(betData.bet === data){
                         // update the points and status
                          
                         admin.database().ref(`bets/${userKey}/${week}/${day}`).update({
                            bet: betData.bet,
                            points: 1,
                            status : 2
                          })
                       }else{
                         // update only status
                           admin.database().ref(`bets/${userKey}/${week}/${day}`).update({
                            bet: betData.bet,
                            points: 0,
                            status : 2
                          })
                       }

                    })


                       
                 })

             
             
            });

   })


  exports.recalculateWeeklyStandings = functions.https.onRequest((request, response) => {

     const week = request.body.week;

     
     // get userid from userProfile node

     admin.database().ref('userProfile').once("value").then((snapshots)=>{
      snapshots.forEach((snapshot)=>{

        let userKey = snapshot.key;
        
        
          // for each id compute the the total points from betList
         admin.database().ref(`bets/${userKey}/d_${week}`).once("value").then((matches)=>{

          

          updatePoints(matches,week,userKey).then(function(done){
            if(done.success){
             // response.json(done);
              // ====================for calculating position=================================
                 
                 admin.database().ref(`ranking_day/d_${week}`).once('value').then((snapshots)=>{
                      let ranking_dayArr = []; 
                      position = 1
                      
                      var ranking_dayObject = snapshots.val()
                      for (let key in ranking_dayObject) {
                        ranking_dayArr.push({ 'key': key, 'points_neg': ranking_dayObject[key]['points_neg'] });
                      }
                      ranking_dayArr.sort(
                        function (a, b) { 
                        var as = a['points_neg'], 
                            bs = b['points_neg']; 
                     
                        return as == bs ? 0 : (as > bs ? 1 : -1); 
                       }
                     ); 

                    for(var i = 0 ; i < ranking_dayArr.length ; i++){

                       
                        if(i === 0){
                         admin.database().ref(`ranking_day/d_${week}/${ranking_dayArr[i].key}`).update({position:position, position_neg: (position * -1)})
                        
                       
                        }else if(ranking_dayArr[i-1].points_neg === ranking_dayArr[i].points_neg){
                         admin.database().ref(`ranking_day/d_${week}/${ranking_dayArr[i].key}`).update({position:position, position_neg: (position * -1)})
                        
                        }else{
                        position = position + 1; 
                         admin.database().ref(`ranking_day/d_${week}/${ranking_dayArr[i].key}`).update({position:position, position_neg: (position * -1)})
                        }
                          

                    } 


                      response.json('success');

                 })

              // ====================for calculating position=================================
               

            }
          })
         
         
         }) 

      })
     })

    


  })



  exports.totalStandings = functions.https.onRequest((request, response) => {


    var promise = new Promise((resolve,reject)=>{
         
         
    
   
    admin.database().ref('userProfile').once('value').then(users => {

       

        users.forEach(user => {

           
          
           admin.database().ref('days').once('value').then(days => {
                 
               admin.database().ref('ranking_day').once('value').then(ranking_days => {

                
                   calculateTotalUserPoints(days,user.key,ranking_days).then(totalUserPoints=>{
                     admin.database().ref(`ranking_summary/${user.key}/`).update({points:totalUserPoints, points_neg: (totalUserPoints * -1)})
                  })

               })

           })

           
        })

    })

     resolve(true);

    }).then(data=>{
        if(data){

             // ====================for calculating position=================================
                 
                 admin.database().ref(`ranking_summary`).once('value').then((snapshots)=>{
                      let ranking_summaryArr = []; 
                      position = 1
                      
                       var ranking_dayObject = snapshots.val()
                      for (let key in ranking_dayObject) {
                        ranking_summaryArr.push({ 'key': key, 'points_neg': ranking_dayObject[key]['points_neg'] });
                      }
                      ranking_summaryArr.sort(
                        function (a, b) { 
                        var as = a['points_neg'], 
                            bs = b['points_neg']; 
                     
                        return as == bs ? 0 : (as > bs ? 1 : -1); 
                       }
                     ); 

                    for(var i = 0 ; i < ranking_summaryArr.length ; i++){

                       
                        if(i === 0){
                         admin.database().ref(`ranking_summary/${ranking_summaryArr[i].key}`).update({position:position, position_neg: (position * -1)})
                        
                       
                        }else if(ranking_summaryArr[i-1].points_neg === ranking_summaryArr[i].points_neg){
                         admin.database().ref(`ranking_summary/${ranking_summaryArr[i].key}`).update({position:position, position_neg: (position * -1)})
                        
                        }else{
                        position = position + 1; 
                         admin.database().ref(`ranking_summary/${ranking_summaryArr[i].key}`).update({position:position, position_neg: (position * -1)})
                        }
                          

                    } 


                      response.json("success");

                 })

        }
    }) 


  })








// returns total user points
  function calculateTotalUserPoints(days,userKey,ranking_days){
    let totalUserPoints = 0;

    ranking_day = ranking_days.val();

    var promise = new Promise((resolve,reject)=>{

      

      days.forEach(day => {

        totalUserPoints =totalUserPoints + ranking_day[day.key][userKey].points;
       
      })
      resolve(totalUserPoints);
    })  

    return promise;

  }


 function updatePoints(matches,week,userKey){
  
  var promise = new Promise((resolve,reject)=>{

     getTotalMatchPoints(matches).then((totalMatchPoints)=>{

            // update ranking using id and points
            admin.database().ref(`ranking_day/d_${week}/${userKey}`).update({
              points: totalMatchPoints,
              points_neg : totalMatchPoints*-1
             })
           

      })

     resolve({success:true});
     
  })

   return promise;
 } 


function getTotalMatchPoints(matches){
   var promise = new Promise((resolve,reject)=>{
      let totalMatchPoints = 0;

       matches.forEach((match)=>{
      
         let matchObject = match.val();

         totalMatchPoints += matchObject.points;

      })
       resolve(totalMatchPoints);

   }); 

 return promise;


}


