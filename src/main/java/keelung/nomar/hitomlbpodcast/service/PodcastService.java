package keelung.nomar.hitomlbpodcast.service;

import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import keelung.nomar.hitomlbpodcast.entity.Chapter;
import keelung.nomar.hitomlbpodcast.entity.Episode;
import org.jdom2.Element;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class PodcastService {

    private final String RSS_URL = "https://media.rss.com/hitomlb/feed.xml";

    // --- 快取機制變數 ---
    private List<Episode> cachedEpisodes = new ArrayList<>();
    private String lastRssHash = ""; // 儲存上一版 RSS 的 MD5 特徵值

    public synchronized List<Episode> fetchEpisodes() {
        try {
            // 1. 取得 RSS 原始 XML 字串
            String currentRssContent = fetchRawRss(RSS_URL);
            if (currentRssContent == null || currentRssContent.isEmpty()) return cachedEpisodes;

            // 2. 計算特徵值 (MD5) 並比對
            String currentHash = DigestUtils.md5DigestAsHex(currentRssContent.getBytes(StandardCharsets.UTF_8));

            if (currentHash.equals(lastRssHash) && !cachedEpisodes.isEmpty()) {
                System.out.println(">>> RSS 內容未變動，回傳快取資料 (Efficiency Optimized)");
                return cachedEpisodes;
            }

            // 3. 內容有變動，執行解析流程
            System.out.println(">>> 偵測到 RSS 更新，開始重新解析...");
            List<Episode> freshEpisodes = parseRss(currentRssContent);

            // 4. 更新快取與特徵值
            this.cachedEpisodes = freshEpisodes;
            this.lastRssHash = currentHash;

            return freshEpisodes;

        } catch (Exception e) {
            e.printStackTrace();
            return cachedEpisodes; // 發生錯誤時回傳最後一次成功的資料
        }
    }

    /**
     * 抓取原始 RSS 文字內容
     */
    private String fetchRawRss(String urlString) throws Exception {
        URLConnection conn = new URL(urlString).openConnection();
        conn.setRequestProperty("User-Agent", "Mozilla/5.0");
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }

    /**
     * 解析 RSS 內容
     */
    private List<Episode> parseRss(String xmlContent) throws Exception {
        List<Episode> episodes = new ArrayList<>();
        SyndFeedInput input = new SyndFeedInput();
        // 將 String 轉回 Reader 供 ROME 解析
        SyndFeed feed = input.build(new XmlReader(new java.io.ByteArrayInputStream(xmlContent.getBytes(StandardCharsets.UTF_8))));

        for (SyndEntry entry : feed.getEntries()) {
            String title = entry.getTitle();
            if (title == null || !title.trim().startsWith("Hito 大聯盟 第")) continue;

            Episode ep = new Episode();
            ep.setTitle(title);
            ep.setLink(entry.getLink());

            String rawHtml = (entry.getDescription() != null) ? entry.getDescription().getValue() : "";
            ep.setFullDescription(rawHtml);
            ep.setPubDate(extractRawDate(rawHtml)); // 如實記錄日期字串

            if (entry.getEnclosures() != null && !entry.getEnclosures().isEmpty()) {
                ep.setAudioUrl(entry.getEnclosures().get(0).getUrl());
            }

            String rawDuration = "";
            for (Object obj : entry.getForeignMarkup()) {
                if (obj instanceof Element el && "duration".equals(el.getName())) {
                    rawDuration = el.getText();
                    break;
                }
            }
            ep.setDuration(formatDuration(rawDuration));
            ep.setChapters(parseChapters(rawHtml));
            episodes.add(ep);
        }
        return episodes;
    }

    private String extractRawDate(String html) {
        if (html == null) return "";
        Pattern pattern = Pattern.compile("Published on:\\s*([^<\\n|]+)");
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    private String formatDuration(String raw) {
        if (raw == null || raw.isEmpty()) return "00:00:00";
        try {
            if (raw.contains(":")) {
                String[] p = raw.split(":");
                int h = 0, m = 0, s = 0;
                if (p.length == 3) {
                    h = Integer.parseInt(p[0]);
                    m = Integer.parseInt(p[1]);
                    s = Integer.parseInt(p[2]);
                } else if (p.length == 2) {
                    m = Integer.parseInt(p[0]);
                    s = Integer.parseInt(p[1]);
                }
                return String.format("%02d:%02d:%02d", h, m, s);
            } else {
                int total = Integer.parseInt(raw);
                return String.format("%02d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60);
            }
        } catch (Exception e) {
            return "00:00:00";
        }
    }

    private List<Chapter> parseChapters(String html) {
        List<Chapter> chapters = new ArrayList<>();
        String cleanText = html.replaceAll("<br\\s*/?>", "\n").replaceAll("<[^>]*>", " ").replaceAll("&nbsp;", " ");
        String sponsorLink = "www.zeczec.com/projects/hitomlb";
        int sponsorIndex = cleanText.indexOf(sponsorLink);
        String targetText = (sponsorIndex != -1) ? cleanText.substring(sponsorIndex + sponsorLink.length()) : cleanText;

        Pattern timePattern = Pattern.compile("\\(((\\d{1,2}:)?\\d{1,2}:\\d{2})\\)");
        Matcher m = timePattern.matcher(targetText);
        int lastMatchPos = 0;
        while (m.find()) {
            String timestamp = m.group(1);
            String title = targetText.substring(lastMatchPos, m.start()).replace("\n", " ").trim();
            if (title.contains("本集討論")) title = title.substring(title.indexOf("本集討論") + 4).trim();
            title = title.replaceAll("^[，。、；;：:：\\s]+", "").trim();
            if (title.length() > 2 && !title.startsWith("http"))
                chapters.add(new Chapter(title, timestamp, timeToSeconds(timestamp)));
            lastMatchPos = m.end();
        }
        return chapters;
    }

    private int timeToSeconds(String t) {
        String[] p = t.split(":");
        try {
            if (p.length == 2) return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
            if (p.length == 3)
                return Integer.parseInt(p[0]) * 3600 + Integer.parseInt(p[1]) * 60 + Integer.parseInt(p[2]);
        } catch (Exception e) {
        }
        return 0;
    }
}