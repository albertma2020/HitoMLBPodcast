package keelung.nomar.hitomlbpodcast.service;

import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import keelung.nomar.hitomlbpodcast.entity.Chapter;
import keelung.nomar.hitomlbpodcast.entity.Episode;
import org.jdom2.Element;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PodcastService {

    private final String RSS_URL = "https://media.rss.com/hitomlb/feed.xml";

    public List<Episode> fetchEpisodes() {
        List<Episode> episodes = new ArrayList<>();
        try {
            URLConnection conn = new URL(RSS_URL).openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0");

            SyndFeedInput input = new SyndFeedInput();
            SyndFeed feed = input.build(new XmlReader(conn));

            for (SyndEntry entry : feed.getEntries()) {
                String title = entry.getTitle();
                if (title == null || !title.trim().startsWith("Hito 大聯盟 第")) continue;

                Episode ep = new Episode();
                ep.setTitle(title);
                ep.setLink(entry.getLink());

                String rawHtml = (entry.getDescription() != null) ? entry.getDescription().getValue() : "";
                ep.setFullDescription(rawHtml);

                // --- 核心修正：如實抓取日期 ---
                String capturedDate = extractRawDate(rawHtml);
                if (capturedDate.isEmpty() && entry.getPublishedDate() != null) {
                    // 備案：若沒抓到文字標籤，才用標準日期（轉為簡單字串避免偏移）
                    capturedDate = entry.getPublishedDate().toString();
                }
                ep.setPubDate(capturedDate);

                // 處理時長與音軌
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
        } catch (Exception e) {
            e.printStackTrace();
        }
        return episodes;
    }

    private String extractRawDate(String html) {
        if (html == null) return "";
        // 修正正則：忽略 HTML 標籤與多餘空白，精準鎖定 Published on: 後的日期
        Pattern pattern = Pattern.compile("Published on:\\s*([^<\\n|]+)");
        Matcher matcher = pattern.matcher(html);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return "";
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