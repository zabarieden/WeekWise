const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt'; 

let supabaseClient;
let currentUsername = '';

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initCubesNavigation();

    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        const pass = document.getElementById('password-input').value;
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if (error) alert(error.message);
        else location.reload();
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        const pass = document.getElementById('password-input').value;
        const { error } = await supabaseClient.auth.signUp({ email, password: pass });
        if (error) alert(error.message);
        else alert('נרשמת בהצלחה!');
    });

    document.getElementById('btn-forgot-password').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        if (!email) return alert('אנא הקלידו אימייל');
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) alert(error.message);
        else alert('נשלח מייל לחידוש סיסמה!');
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        location.reload();
    });

    document.getElementById('btn-run-ai').addEventListener('click', runSmartAIParser);
    checkAuth();
});

async function checkAuth() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        currentUsername = data.session.user.email;
        console.log("Logged in as:", currentUsername);
    }
}

function runSmartAIParser() {
    const text = document.getElementById('ai-nutrition-prompt').value.trim();
    if (!text) return alert('הקלידו פקודה');
    alert('AI מנתח את הפקודה: ' + text);
    document.getElementById('ai-nutrition-prompt').value = '';
}

function initCubesNavigation() {
    const cubes = document.querySelectorAll('.nav-cube');
    const tabContents = document.querySelectorAll('.tab-content');
    cubes.forEach(cube => {
        cube.addEventListener('click', () => {
            cubes.forEach(c => c.classList.remove('active'));
            cube.classList.add('active');
            tabContents.forEach(tab => tab.classList.remove('active-tab'));
            document.getElementById(cube.dataset.target).classList.add('active-tab');
        });
    });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
