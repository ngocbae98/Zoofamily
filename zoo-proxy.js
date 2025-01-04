const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const crypto = require("crypto");
const asyncLib = require('async');

const SoLuong = 10; //Tuỳ chỉnh số luồng tại đây

class Zoo {
    constructor() {
        this.baseHeaders = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            "Origin": "https://game.zoo.team",
            "Referer": "https://game.zoo.team/",
            "Is-Beta-Server": "null",
            "Sec-Ch-Ua": '"Chromium";v="130", "Microsoft Edge";v="130", "Not?A_Brand";v="99", "Microsoft Edge WebView2";v="130"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"
        };
        this.cachedData = null;
        this.proxyList = [];
    }

    resetCache() {
        this.cachedData = null;
    }

    log(msg, type = 'info', accNumber = 'N/A', proxyIP = 'N/A') {
        const timestamp = new Date().toLocaleTimeString();
        const accountInfo = accNumber !== 'N/A' && proxyIP !== 'N/A' ? `[Acc ${accNumber}] [IP ${proxyIP}]` : '';
        switch (type) {
            case 'success':
                console.log(`[${timestamp}] ${accountInfo} [✓] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] ${accountInfo} [*] ${msg}`.magenta);
                break;
            case 'error':
                console.log(`[${timestamp}] ${accountInfo} [✗] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] ${accountInfo} [!] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] ${accountInfo} [ℹ] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async md5(input) {
        return crypto.createHash("md5").update(input).digest("hex");
    }

    // Hàm tạo API hash
    async createApiHash(timestamp, data) {
        const combinedData = `${timestamp}_${data}`;
        const encodedData = encodeURIComponent(combinedData);
        return this.md5(encodedData);
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    getAxiosConfig(proxyUrl) {
        return {
            headers: this.headers,
            httpsAgent: new HttpsProxyAgent(proxyUrl)
        };
    }

    async getAllData(apiHash, proxyUrl, accNumber, proxyIP) {
        const currentTime = Date.now();

        // Kiểm tra nếu dữ liệu đã được cache
        if (this.cachedData) {
            return this.cachedData;
        }

        const dataPayload = JSON.stringify({ data: {} });
        const apiTime = Math.floor(currentTime / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/user/data/all";

        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };

        try {
            const response = await axios.post(url, dataPayload, config);
            if (response.status === 200 && response.data.data) {
                this.cachedData = response.data.data; // Lưu cache
                return this.cachedData;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            throw new Error(`Error fetching data: ${error.message}`);
        }
    }

    async getAllInfo(apiHash, proxyUrl, accNumber, proxyIP) {
        try {
            const data = await this.getAllData(apiHash, proxyUrl, accNumber, proxyIP);
            const { coins, tokens } = data.hero;
            return {
                success: true, data: { coins, tokens }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async performCheckIn(apiHash, canTakeRewardKey, proxyUrl, accNumber, proxyIP) {
        const url = "https://api.zoo.team/quests/daily/claim";
        const claimPayload = JSON.stringify({ data: parseInt(canTakeRewardKey) });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, claimPayload);
        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };

        try {
            const response = await axios.post(url, claimPayload, config);
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkInDaily(apiHash, proxyUrl, accNumber, proxyIP) {
        const dataPayload = JSON.stringify({ data: { lang: "en" } });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/user/data/after";
        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };

        try {
            const response = await axios.post(url, dataPayload, config);

            if (response.status === 200 && response.data.data) {
                const dailyRewards = response.data.data.dailyRewards;

                const canTakeRewardKey = Object.keys(dailyRewards).find(
                    key => dailyRewards[key] === "canTake"
                );

                if (canTakeRewardKey) {
                    const claimResponse = await this.performCheckIn(apiHash, canTakeRewardKey, proxyUrl, accNumber, proxyIP);
                    if (claimResponse.success) {
                        this.log(`Điểm danh thành công`, 'success', accNumber, proxyIP);
                    } else {
                        this.log(`Điểm danh thất bại`, 'error', accNumber, proxyIP);
                    }
                } else {
                    this.log('Đã điểm danh hôm nay', 'warning', accNumber, proxyIP);
                }
            } else {
                this.log('Invalid response format', 'error', accNumber, proxyIP);
            }
        } catch (error) {
            this.log(`Lỗi checkrewards: ${error.message}`, 'error', accNumber, proxyIP);
        }
    }

    async autoFeed(apiHash, proxyUrl, accNumber, proxyIP) {

        const utcToVietNamTime = (utcDate) => {
            const date = new Date(utcDate + "Z");
            date.setHours(date.getHours() + 7);
            return date.toISOString().replace("T", " ").slice(0, 19);
        };

        try {
            const data = await this.getAllData(apiHash, proxyUrl, accNumber, proxyIP);
            const dbFeed = data.feed;
            // Chuyển đổi giờ UTC sang giờ Việt Nam
            const nextFeedTimeVN = utcToVietNamTime(dbFeed.nextFeedTime);

            this.log(`Thời gian cho ăn tiếp theo: ${nextFeedTimeVN}`, 'custom', accNumber, proxyIP);
            if (dbFeed.isNeedFeed) {
                const result = await this.buyFeed(apiHash, proxyUrl, accNumber, proxyIP);
                if (result.success) {
                    this.log(`Mua thức ăn thành công`, 'success', accNumber, proxyIP);
                } else {
                    this.log(`Mua thức ăn thất bại`, 'error', accNumber, proxyIP);
                }
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }


    async buyFeed(apiHash, proxyUrl, accNumber, proxyIP) {
        const dataPayload = JSON.stringify({ data: "instant" });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/autofeed/buy";
        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };
        try {
            const response = await axios.post(url, dataPayload, config);
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async AnswerDaily(apiHash, questKey, checkData, proxyUrl, accNumber, proxyIP) {
        const dataPayload = JSON.stringify({ data: [questKey, checkData] });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/quests/check";
        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };

        try {
            const response = await axios.post(url, dataPayload, config);
            if (response.status === 200 && response.data.success) {
                return await this.claimQuest(apiHash, questKey, checkData, proxyUrl, accNumber, proxyIP);
            } else {
                this.log(`Kiểm tra nhiệm vụ "${questKey}" thất bại: ${response.data.error}`, 'warning', accNumber, proxyIP);
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            this.log(`Lỗi khi kiểm tra nhiệm vụ "${questKey}": ${error.message}`, 'error', accNumber, proxyIP);
            return { success: false, error: error.message };
        }
    }

    async completeAllQuests(apiHash, proxyUrl, accNumber, proxyIP) {
        try {
            const data = await this.getAllData(apiHash, proxyUrl, accNumber, proxyIP);
            const quests = data.dbData.dbQuests;

            for (const quest of quests) {
                if (quest.checkType === "donate_ton" ||
                    quest.checkType === "invite" ||
                    quest.checkType === "username" ||
                    quest.checkType === "ton_wallet_transaction"
                ) {
                    continue;
                }

                if (quest.checkType === "checkCode") {
                    this.log(`Bắt đầu làm nhiệm vụ trả lời câu hỏi hằng ngày...`, 'custom', accNumber, proxyIP);
                    await this.AnswerDaily(apiHash, quest.key, quest.checkData, proxyUrl, accNumber, proxyIP);
                    continue;
                }

                const claimResult = await this.claimQuest(apiHash, quest.key, quest.checkData, proxyUrl, accNumber, proxyIP);
                if (claimResult.success === true) {
                    this.log(`Hoàn thành nhiệm vụ "${quest.title}", nhận ${quest.reward} phần thưởng.`, 'success', accNumber, proxyIP);
                }
                else if (claimResult.error === "already rewarded") {
                    this.log(`Nhiệm vụ "${quest.title}" đã được hoàn thành trước đó.`, 'warning', accNumber, proxyIP);
                } else {
                    this.log(`Không thể hoàn thành hoặc cần làm bằng tay nhiệm vụ "${quest.title}": ${claimResult.error}`, 'warning', accNumber, proxyIP);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`, 'error', accNumber, proxyIP);
        }
    }

    async claimQuest(apiHash, questKey, checkData = null, proxyUrl, accNumber, proxyIP) {
        const dataPayload = JSON.stringify({ data: [questKey, checkData] });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/quests/claim";
        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };

        try {
            const response = await axios.post(url, dataPayload, config);
            if (response.status === 200 && response.data.success) {
                this.log(`Claim nhiệm vụ "${questKey}" thành công, nhận thưởng.`, 'success', accNumber, proxyIP);
                return { success: true, data: response.data };
            } else {
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            this.log(`Lỗi khi claim nhiệm vụ "${questKey}": ${error.message}`, 'error', accNumber, proxyIP);
            return { success: false, error: error.message };
        }
    }

    async BuyAnimal(apiHash, proxyUrl, accNumber, proxyIP) {
        try {
            const data = await this.getAllData(apiHash, proxyUrl, accNumber, proxyIP);
            const myAnimal = data.animals;
            const dbData = data.dbData.dbAnimals;
            const myAnimalIds = new Set(myAnimal.map(animal => animal.key));
            const availableAnimals = dbData.filter(animal => !myAnimalIds.has(animal.key));

            const { coins } = data.hero;

            for (const animal of availableAnimals) {
                const occupiedPositions = new Set(myAnimal.map(animal => animal.position));
                const availablePositions = Array.from({ length: 34 }, (_, i) => i + 1).filter(pos => !occupiedPositions.has(pos));

                if (availablePositions.length === 0) {
                    this.log(`Không còn vị trí trống để đặt animal "${animal.title}".`, 'warning', accNumber, proxyIP);
                    continue;
                }

                const position = availablePositions[0];
                const levelOnePrice = animal.levels[0].price;
                if (coins >= levelOnePrice) {
                    const buyResult = await this.ConFirmBuyAnimal(apiHash, animal.key, position, proxyUrl, accNumber, proxyIP);
                    if (buyResult.success) {
                        this.log(`Mua thành công animal "${animal.title}" với giá ${animal.levels[0].price} coins.`, 'success', accNumber, proxyIP);
                    } else {
                        this.log(`Mua animal "${animal.title}" thất bại: ${buyResult.error}`, 'error', accNumber, proxyIP);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    this.log(`Không đủ coins để mua animal "${animal.title}".`, 'warning', accNumber, proxyIP);
                }
            }
        } catch (error) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`, 'error', accNumber, proxyIP);
        }
    }

    async ConFirmBuyAnimal(apiHash, animalId, position, proxyUrl, accNumber, proxyIP) {
        const dataPayload = JSON.stringify({ data: { position, animalKey: animalId } });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/animal/buy";
        const config = {
            ...this.getAxiosConfig(proxyUrl),
            headers: {
                ...this.baseHeaders,
                "api-hash": `${apiKey}`,
                "Api-Key": `${apiHash}`,
                "Api-Time": `${apiTime}`
            }
        };

        try {
            const response = await axios.post(url, dataPayload, config);
            if (response.status === 200 && response.data.success) {
                return { success: true, data: response.data };
            } else {
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const proxyFile = path.join(__dirname, 'proxy.txt');

        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        this.proxyList = fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        this.log(`Tool được phát triển bỏi jackphan tải và cập nhật miễn phí tại: https://t.me/airdropJackPhan `, 'warning');
        this.log(`Have any issuess, please contact: https://t.me/airdropJackPhan `, 'warning');

        const queue = asyncLib.queue(async (task, callback) => {
            const { initData, proxyUrl, accNumber } = task;
            const userData = JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0]));
            const apiHash = initData.split('hash=')[1];
            const firstName = userData.first_name;
            let proxyIP = "Unknown";

            try {
                proxyIP = await this.checkProxyIP(proxyUrl);
            } catch (error) {
                this.log(`Lỗi kiểm tra IP proxy: ${error.message}`, 'error', accNumber, proxyIP);
                return callback();
            }

            this.log(`Đang xử lý tài khoản ${firstName.green}`, 'success', accNumber, proxyIP);

            try {
                const getAllInfo = await this.getAllInfo(apiHash, proxyUrl, accNumber, proxyIP);
                if (getAllInfo.success) {
                    const { coins, tokens } = getAllInfo.data;
                    this.log(`Số coins: ${coins}, số tokens: ${tokens}`, 'custom', accNumber, proxyIP);
                } else {
                    this.log(`Không thể lấy thông tin người dùng: ${getAllInfo.error}`, 'error', accNumber, proxyIP);
                }

                await this.autoFeed(apiHash, proxyUrl, accNumber, proxyIP);
                await this.checkInDaily(apiHash, proxyUrl, accNumber, proxyIP);
                await this.completeAllQuests(apiHash, proxyUrl, accNumber, proxyIP);
                await this.BuyAnimal(apiHash, proxyUrl, accNumber, proxyIP);
            } catch (error) {
                this.log(`Lỗi xử lý tài khoản ${firstName}: ${error.message}`, 'error', accNumber, proxyIP);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            callback();
        }, SoLuong); // ✚ Đặt độ đồng thời tối đa là 10

        queue.drain(() => {
            this.log('Đã xử lý hết tất cả các tài khoản. Đang chờ 61 phút trước khi lặp lại...', 'info');
            this.resetCache();
            this.countdown(61 * 60, 'info').then(() => {
                data.forEach((initData, index) => {
                    const proxyUrl = this.proxyList[index % this.proxyList.length];
                    const accNumber = index + 1;
                    queue.push({ initData, proxyUrl, accNumber });
                });
            });
        });

        data.forEach((initData, index) => {
            const proxyUrl = this.proxyList[index % this.proxyList.length];
            const accNumber = index + 1;
            queue.push({ initData, proxyUrl, accNumber });
        });

    }

}
const client = new Zoo();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});