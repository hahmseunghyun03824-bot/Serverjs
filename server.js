// server.js (로그 강화 및 최종 점검 코드)

const express = require('express');
const { MongoClient } = require('mongodb'); 
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; 

// 환경 변수에서 MongoDB URI를 불러옵니다. (Render에서 설정할 값)
const MONGODB_URI = process.env.MONGODB_URI; 
const DB_NAME = "surveyDB"; 

// --- 미들웨어 설정 ---
app.use(cors()); 
app.use(express.json());

// 헬스 체크용 루트 경로
app.get('/', (req, res) => {
    res.status(200).send("Survey Backend API is running.");
});

// MongoDB 연결을 처리하는 헬퍼 함수
async function connectToMongo() {
    const client = new MongoClient(MONGODB_URI);
    try {
        console.log("Attempting to connect to MongoDB...");
        await client.connect();
        console.log("MongoDB connection successful!");
        const database = client.db(DB_NAME);
        return { client, database };
    } catch (error) {
        // **치명적인 연결 오류 로그**
        console.error("--- FATAL MONGO DB CONNECTION ERROR ---");
        console.error("Please check MONGODB_URI, password, and Network Access settings in MongoDB Atlas.");
        console.error("Error details:", error.message);
        throw error; // 오류를 다시 던져서 API 핸들러가 500 응답을 보내게 함
    }
}


// 0. 사용자 등록 (Sign Up) API - /register
app.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, gender, gradeLevel } = req.body;

    if (!email || !password || !gender || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields (email, password, gender, gradeLevel)." });
    }

    let client;
    try {
        // 1. MongoDB 연결 시도 (여기서 실패할 가능성이 가장 높습니다)
        ({ client, database } = await connectToMongo());
        const users = database.collection('users');

        // 2. 이미 존재하는 이메일 확인
        const existingUser = await users.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "Email already registered." });
        }

        // 3. 데이터 저장
        const result = await users.insertOne({
            email,
            password, 
            firstName: firstName || null, 
            lastName: lastName || null,   
            gender,
            gradeLevel,
            registrationDate: new Date()
        });
        
        const fakeNumericId = Math.floor(Math.random() * 90000000) + 10000000; 

        // 성공 응답: 201 Created
        res.status(201).json({ 
            message: "User registered successfully!", 
            userID: fakeNumericId,
            mongoId: result.insertedId.toString()
        });

    } catch (err) {
        // connectToMongo에서 던진 오류 또는 데이터베이스 쿼리 오류 처리
        console.error('[API ERROR] User registration failed:', err.message);
        res.status(500).json({ error: "Server error during registration. Check Render logs for connection details.", details: err.message });
    } finally {
        if (client) {
            // MongoDB 연결을 닫기 전에 연결이 열려있는지 확인
            try {
                await client.close(); 
            } catch (closeErr) {
                console.warn("Error closing MongoDB connection:", closeErr.message);
            }
        }
    }
});


// 1. 설문조사 응답 제출 API (생략)
app.post('/api/submit', async (req, res) => {
    const data = req.body;
    let client;
    try {
        ({ client, database } = await connectToMongo());
        const responses = database.collection('responses'); 

        const result = await responses.insertOne({
            ...data,
            timestamp: new Date(),
        });

        res.status(201).json({ message: "Survey submitted successfully!", id: result.insertedId });
    } catch (err) {
        console.error('[API ERROR] Submission failed:', err.message);
        res.status(500).json({ message: "Server error during submission." });
    } finally {
        if (client) {
            try { await client.close(); } catch (e) {}
        }
    }
});

// 2. 결과 데이터 가져오기 API (생략)
app.get('/api/results', async (req, res) => {
    let client;
    try {
        ({ client, database } = await connectToMongo());
        const responses = database.collection('responses');

        const results = await responses.find({}).sort({ timestamp: -1 }).toArray();

        const processedResults = results.map(row => {
            const finalRow = { ...row, id: row._id };
            delete finalRow._id; 
            return finalRow;
        });

        res.json(processedResults);
    } catch (err) {
        console.error('[API ERROR] Fetching results failed:', err.message);
        res.status(500).json({ message: "Server error fetching results." });
    } finally {
        if (client) {
            try { await client.close(); } catch (e) {}
        }
    }
});


// --- 서버 시작 ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
