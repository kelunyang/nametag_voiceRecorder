JavaScript 桌牌+錄音器
=====================

設計目的&使用場景
---------------
1. 常常不在辦公桌，小紙片淹沒桌面
1. 不想讓大家知道你全部的行程，只想要告訴他們你現在在哪裡
1. 你需要即時處理留言，但不想給大家你的通訊軟體

運行環境
-------
1. 客戶端：一台可以連上網的舊平板、舊手機、Raspberry pi（畢竟是取代桌牌的，用電腦就太誇張），有瀏覽器即可（Firefox、Chrome）
1. Server端：node.js 務必在8以上，支援async/await
1. 即時通訊軟體：請申請一個telegram帳號，並註冊一個telegram bot，把key複製下來即可
1. 行事曆Source：Google或Outlook.com都可以，總之找到行事曆公開的ics網址即可，所以你不需要公布全部的行事曆，可以選擇公布你需要的那一類行事曆即可

功能
----
1. 顯示當下的行事曆，支援多組行事曆（請複製好行事曆的ics網址，google和outlook.com都支援）
1. 提供快速問答，你可以建立好一些問題，讓人們快速回復你，這專門處理大量重複性問題用的
1. 如果有一些臨時性問題，可以啟動錄音，之所以不提供打字回復，是考慮到語氣在手機上打字，一般人寧可留字條
1. 所有非語音的留言都會顯示出來，其他人也看的到，搞不好他們只是在找同樣的東西被借到誰手上而已
1. 所有的留言都會用telegram及時發送，就算你不在座位上，也能即時知道大家要幹嘛
1. 本系統支援多人使用，只要在網址列加入URL變數userID即可

Database Schema
---------------
1. 本來要使用sqlite，但node.js 8的sqlite driver有bug，先改用mysql
1. gadgetmessages
    1. id(int) primary key
    1. message(text)
    1. questionID(int) foreign key to questionlist\id
    1. user(varchar) fortign key to userlist\id
    1. timestamp(int)
1. questionlist
    1. id(int) primary key
    1. question(text)
    1. answers(text)
    1. user(varchar) foreign key to userlist\id
1. userlist
    1. id(varchar) primary key
    1. name(text)
    1. telegramid(int)
    1. title(text)
    1. ics(text)

TODO List
---------
1. 後台管理（用戶管理、訊息管理等等），目前尚未實作
1. 錄音時的即時波形圖（使用wavesufer.js），其實已經完成了，但raspberry pi上的Chromium瀏覽器的decoder有問題，因此暫時封閉

開發者&授權
----------
Kelunyang (kelunyang@outlook.com) @ 2017 GNU授權