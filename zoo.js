const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const crypto = require("crypto");

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
    }

    resetCache() {
        this.cachedData = null;
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch (type) {
            case 'success':
                console.log(`[${timestamp}] [✓] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;
            case 'error':
                console.log(`[${timestamp}] [✗] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [!] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [ℹ] ${msg}`.blue);
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

    async getAllData(apiHash) {
        const currentTime = Date.now();

        // Kiểm tra nếu dữ liệu đã được cache
        if (this.cachedData) {
            return this.cachedData;
        }

        const dataPayload = JSON.stringify({ data: {} });
        const apiTime = Math.floor(currentTime / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/user/data/all";
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`
        };

        try {
            const response = await axios.post(url, dataPayload, { headers });
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

    async getAllInfo(apiHash) {
        try {
            const data = await this.getAllData(apiHash);
            const { coins, tokens } = data.hero;
            return {
                success: true, data: { coins, tokens }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async performCheckIn(apiHash, canTakeRewardKey) {
        const url = "https://api.zoo.team/quests/daily/claim";
        const claimPayload = JSON.stringify({ data: parseInt(canTakeRewardKey) });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, claimPayload);
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`
        };

        try {
            const response = await axios.post(url, claimPayload, { headers });
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkInDaily(apiHash) {
        const dataPayload = JSON.stringify({ data: { lang: "en" } });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/user/data/after";
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`
        };

        try {
            const response = await axios.post(url, dataPayload, { headers });

            if (response.status === 200 && response.data.data) {
                const dailyRewards = response.data.data.dailyRewards;

                const canTakeRewardKey = Object.keys(dailyRewards).find(
                    key => dailyRewards[key] === "canTake"
                );

                if (canTakeRewardKey) {
                    const claimResponse = await this.performCheckIn(apiHash, canTakeRewardKey);
                    if (claimResponse.success) {
                        this.log(`Điểm danh thành công`, 'success');
                    } else {
                        this.log(`Điểm danh thất bại`, 'error');
                    }
                } else {
                    this.log('Đã điểm danh hôm nay', 'warning');
                }
            } else {
                this.log('Invalid response format', 'error');
            }
        } catch (error) {
            this.log(`Lỗi checkrewards: ${error.message}`, 'error');
        }
    }

    async autoFeed(apiHash) {

        const utcToVietNamTime = (utcDate) => {
            const date = new Date(utcDate + "Z");
            date.setHours(date.getHours() + 7);
            return date.toISOString().replace("T", " ").slice(0, 19);
        };

        try {
            const data = await this.getAllData(apiHash);
            const dbFeed = data.feed;
            // Chuyển đổi giờ UTC sang giờ Việt Nam
            const nextFeedTimeVN = utcToVietNamTime(dbFeed.nextFeedTime);

            this.log(`Thời gian cho ăn tiếp theo: ${nextFeedTimeVN}`, 'custom');
            if (dbFeed.isNeedFeed) {
                const result = await this.buyFeed(apiHash);
                if (result.success) {
                    this.log(`Mua thức ăn thành công`, 'success');
                } else {
                    this.log(`Mua thức ăn thất bại`, 'error');
                }
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }


    async buyFeed(apiHash) {
        const dataPayload = JSON.stringify({ data: "instant" });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/autofeed/buy";
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`
        };

        try {
            const response = await axios.post(url, dataPayload, { headers });
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async AnswerDaily(apiHash, questKey, checkData) {
        const dataPayload = JSON.stringify({ data: [questKey, checkData] });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/quests/check";
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`
        };

        try {
            const response = await axios.post(url, dataPayload, { headers });
            if (response.status === 200 && response.data.success) {
                return await this.claimQuest(apiHash, questKey, checkData);
            } else {
                this.log(`Kiểm tra nhiệm vụ "${questKey}" thất bại: ${response.data.error}`, 'warning');
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            this.log(`Lỗi khi kiểm tra nhiệm vụ "${questKey}": ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async completeAllQuests(apiHash) {
        try {
            const data = await this.getAllData(apiHash);
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
                    this.log(`Bắt đầu làm nhiệm vụ trả lời câu hỏi hằng ngày...`, 'custom');
                    await this.AnswerDaily(apiHash, quest.key, quest.checkData);
                    continue;
                }

                const claimResult = await this.claimQuest(apiHash, quest.key);
                if (claimResult.success === true) {
                    this.log(`Hoàn thành nhiệm vụ "${quest.title}", nhận ${quest.reward} phần thưởng.`, 'success');
                }
                else if (claimResult.error === "already rewarded") {
                    this.log(`Nhiệm vụ "${quest.title}" đã được hoàn thành trước đó.`, 'warning');
                } else {
                    this.log(`Không thể hoàn thành hoặc cần làm bằng tay nhiệm vụ "${quest.title}": ${claimResult.error}`, 'warning');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`, 'error');
        }
    }

    async claimQuest(apiHash, questKey, checkData = null) {
        const dataPayload = JSON.stringify({ data: [questKey, checkData] });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/quests/claim";
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`,
        };

        try {
            const response = await axios.post(url, dataPayload, { headers });
            if (response.status === 200 && response.data.success) {
                this.log(`Claim nhiệm vụ "${questKey}" thành công, nhận thưởng.`, 'success');
                return { success: true, data: response.data };
            } else {
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            this.log(`Lỗi khi claim nhiệm vụ "${questKey}": ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async BuyAnimal(apiHash) {
        try {
            const data = await this.getAllData(apiHash);
            const myAnimal = data.animals;
            const dbData = data.dbData.dbAnimals;
            const myAnimalIds = new Set(myAnimal.map(animal => animal.key));
            const availableAnimals = dbData.filter(animal => !myAnimalIds.has(animal.key));

            const { coins } = data.hero;

            for (const animal of availableAnimals) {
                const occupiedPositions = new Set(myAnimal.map(animal => animal.position));
                const availablePositions = Array.from({ length: 34 }, (_, i) => i + 1).filter(pos => !occupiedPositions.has(pos));

                if (availablePositions.length === 0) {
                    this.log(`Không còn vị trí trống để đặt animal "${animal.title}".`, 'warning');
                    continue;
                }

                const position = availablePositions[0];
                const levelOnePrice = animal.levels[0].price;
                if (coins >= levelOnePrice) {
                    const buyResult = await this.ConFirmBuyAnimal(apiHash, animal.key, position);
                    if (buyResult.success) {
                        this.log(`Mua thành công animal "${animal.title}" với giá ${animal.levels[0].price} coins.`, 'success');
                    } else {
                        this.log(`Mua animal "${animal.title}" thất bại: ${buyResult.error}`, 'error');
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    this.log(`Không đủ coins để mua animal "${animal.title}".`, 'warning');
                }
            }
        } catch (error) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`, 'error');
        }
    }

    async ConFirmBuyAnimal(apiHash, animalId, position) {
        const dataPayload = JSON.stringify({ data: { position, animalKey: animalId } });
        const apiTime = Math.floor(Date.now() / 1000);
        const apiKey = await this.createApiHash(apiTime, dataPayload);
        const url = "https://api.zoo.team/animal/buy";
        const headers = {
            ...this.baseHeaders,
            "api-hash": `${apiKey}`,
            "Api-Key": `${apiHash}`,
            "Api-Time": `${apiTime}`
        };

        try {
            const response = await axios.post(url, dataPayload, { headers });
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
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        this.log(`Tool được phát triển bỏi jackphan tải và cập nhật miễn phí tại: https://t.me/airdropJackPhan `, 'custom');
        this.log(`Nếu bạn gặp vấn đề hãy liên hệ tại: https://t.me/airdropJackPhan `, 'custom');
        this.log(`Have any issuess, please contact: https://t.me/airdropJackPhan `, 'custom');
        while (true) {
            for (let i = 0; i < data.length; i++) {
                this.resetCache();
                const initData = data[i];
                const userData = JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0]));
                const apiHash = initData.split('hash=')[1]
                const firstName = userData.first_name;
                console.log(`========== Tài khoản ${i + 1} | ${firstName.green} ==========`);

                const getAllInfo = await this.getAllInfo(apiHash);
                if (getAllInfo.success) {
                    const { coins, tokens } = getAllInfo.data;
                    this.log(`Số coins: ${coins}, số tokens: ${tokens}`, 'custom');
                } else {
                    this.log(`Không thể lấy thông tin người dùng: ${getAllInfo.error}`, 'error');
                }
                await this.autoFeed(apiHash);
                await this.checkInDaily(apiHash);
                await this.completeAllQuests(apiHash);
                await this.BuyAnimal(apiHash);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(61 * 60);
        }
    }

}
const client = new Zoo();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});