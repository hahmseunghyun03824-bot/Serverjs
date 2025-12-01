// server.js (수정된 코드)

const express = require('express');
const { MongoClient } = require('mongodb'); // MongoDB 드라이버 불러오기
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // Render는 PORT 환경 변수를 사용합니다.

// 환경 변수에서 MongoDB URI를 불러옵니다. (Render에서 설정할 값)
const MONGODB_URI = process.env.MONGODB_URI; 
const client = new MongoClient(MONGODB_URI);
const DB_NAME = "surveyDB"; // 데이터베이스 이름 지정

// --- 미들웨어 설정 ---
// CORS 허용 (프론트엔드와 백엔드가 다른 도메인일 때 필수)
app.use(cors()); 
// JSON 요청 본문을 파싱하기 위한 설정
app.use(express.json());

// 헬스 체크용 루트 경로
app.get('/', (req, res) => {
    res.status(200).send("Survey Backend API is running.");
});

// --- API 엔드포인트 ---

// 0. 사용자 등록 (Sign Up) API - /register (추가된 엔드포인트)
app.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, gender, gradeLevel } = req.body;

    // 필수 필드 확인
    if (!email || !password || !gender || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields (email, password, gender, gradeLevel)." });
    }

    try {
        await client.connect();
        const database = client.db(DB_NAME);
        const users = database.collection('users'); // 사용자 정보를 저장할 컬렉션

        // 1. 이미 존재하는 이메일 확인 (중복 등록 방지)
        const existingUser = await users.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "Email already registered." });
        }

        // 2. 데이터 저장 (실제 서비스에서는 보안을 위해 비밀번호를 반드시 해시해야 합니다.)
        const result = await users.insertOne({
            email,
            password, // 경고: 실제 환경에서는 bcrypt 등을 사용하여 비밀번호를 반드시 해시해야 합니다.
            firstName: firstName || null, // Optional 필드 처리
            lastName: lastName || null,   // Optional 필드 처리
            gender,
            gradeLevel,
            registrationDate: new Date()
        });
        
        // 프론트엔드 JavaScript가 `userID > 0`인 숫자를 예상하므로 임시 숫자 ID를 반환합니다.
        // MongoDB의 ObjectId는 숫자가 아니므로, 클라이언트의 로직에 맞추기 위한 처리입니다.
        const fakeNumericId = Math.floor(Math.random() * 90000000) + 10000000; 

        // 성공 응답: 201 Created
        res.status(201).json({ 
            message: "User registered successfully!", 
            userID: fakeNumericId,
            mongoId: result.insertedId.toString()
        });

    } catch (err) {
        console.error('Error during user registration:', err.message);
        // 서버 내부 오류 응답: 500 Internal Server Error
        res.status(500).json({ error: "Server error during registration.", details: err.message });
    } finally {
        await client.close(); // 연결 닫기
    }
});


// 1. 설문조사 응답 제출 API
app.post('/api/submit', async (req, res) => {
    const data = req.body;

    try {
        await client.connect();
        const database = client.db(DB_NAME);
        const responses = database.collection('responses'); // 컬렉션(테이블) 이름 지정

        // 데이터 삽입
        const result = await responses.insertOne({
            ...data,
            timestamp: new Date(),
        });

        res.status(201).json({ message: "Survey submitted successfully!", id: result.insertedId });
    } catch (err) {
        console.error('Error inserting data:', err.message);
        res.status(500).json({ message: "Server error during submission." });
    } finally {
        await client.close(); // 연결 닫기
    }
});

// 2. 결과 데이터 가져오기 API
app.get('/api/results', async (req, res) => {
    try {
        await client.connect();
        const database = client.db(DB_NAME);
        const responses = database.collection('responses');

        const results = await responses.find({}).sort({ timestamp: -1 }).toArray();

        const processedResults = results.map(row => {
            const finalRow = { ...row, id: row._id };
            delete finalRow._id; 
            return finalRow;
        });

        res.json(processedResults);
    } catch (err) {
        console.error('Error fetching data:', err.message);
        res.status(500).json({ message: "Server error fetching results." });
    } finally {
        await client.close();
    }
});


// --- 서버 시작 ---
// Render의 환경 변수 PORT를 사용하거나, 없으면 3000 사용
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
