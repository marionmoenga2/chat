constAPI_BASE_URL='https://chat-backend-rg75.onrender.com';

asyncfunctioncheckAuth(){
consttoken=localStorage.getItem('access_token');
if(!token)returnfalse;

try{
constresponse=awaitfetch(API_BASE_URL+'/api/auth/me',{
headers:{'Authorization':'Bearer'+token}
});
returnresponse.ok;
}catch(e){returnfalse;}
}

asyncfunctionlogin(username,password){
consterrorDiv=document.getElementById('errorMessage');
if(errorDiv)errorDiv.textContent='';

try{
constformData=newURLSearchParams();
formData.append('username',username);
formData.append('password',password);

constresponse=awaitfetch(API_BASE_URL+'/api/auth/login',{
method:'POST',
headers:{'Content-Type':'application/x-www-form-urlencoded'},
body:formData
});

if(!response.ok){
consterror=awaitresponse.json();
thrownewError(error.detail||'Loginfailed');
}

constdata=awaitresponse.json();
localStorage.setItem('access_token',data.access_token);
localStorage.setItem('user',JSON.stringify(data.user));
window.location.replace('index.html');

}catch(error){
if(errorDiv)errorDiv.textContent=error.message;
elsealert('Loginfailed:'+error.message);
}
}

asyncfunctionregister(username,email,password){
consterrorDiv=document.getElementById('errorMessage');
if(errorDiv)errorDiv.textContent='';

try{
constresponse=awaitfetch(API_BASE_URL+'/api/auth/register',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({username,email,password})
});

if(!response.ok){
consterror=awaitresponse.json();
thrownewError(error.detail||'Registrationfailed');
}

alert('Registrationsuccessful!Pleaselogin.');
window.location.replace('login.html');

}catch(error){
if(errorDiv)errorDiv.textContent=error.message;
elsealert('Registrationfailed:'+error.message);
}
}

functionlogout(){
localStorage.clear();
window.location.replace('login.html');
}

window.checkAuth=checkAuth;
window.login=login;
window.register=register;
window.logout=logout;
window.API_BASE_URL=API_BASE_URL;
