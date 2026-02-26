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
import java.text.SimpleDateFormat;
import java.util.*;
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

            SyndFeed feed = new SyndFeedInput().build(new XmlReader(conn));

            // 固定日期格式與 UTC 時區，確保與 RSS 原文日期一致
            SimpleDateFormat sdf = new SimpleDateFormat("MMM dd, yyyy (EEE)", Locale.ENGLISH);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));

            for (SyndEntry entry : feed.getEntries()) {
                String title = entry.getTitle();
                if (title == null || !title.trim().startsWith("Hito 大聯盟 第")) {
                    continue;
                }

                Episode ep = new Episode();
                ep.setTitle(title);
                ep.setLink(entry.getLink());
                ep.setPubDate(entry.getPublishedDate() != null ? sdf.format(entry.getPublishedDate()) : "");

                if (entry.getEnclosures() != null && !entry.getEnclosures().isEmpty()) {
                    ep.setAudioUrl(entry.getEnclosures().get(0).getUrl());
                }

                // 處理總時長
                String rawDuration = "";
                for (Element el : entry.getForeignMarkup()) {
                    if ("duration".equals(el.getName())) {
                        rawDuration = el.getText();
                        break;
                    }
                }
                ep.setDuration(formatDuration(rawDuration));

                String rawHtml = entry.getDescription() != null ? entry.getDescription().getValue() : "";
                ep.setFullDescription(rawHtml);
                ep.setChapters(parseChapters(rawHtml));
                episodes.add(ep);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return episodes;
    }

    private String formatDuration(String raw) {
        if (raw == null || raw.isEmpty()) return "00:00:00";
        if (raw.matches("\\d+")) {
            int totalSec = Integer.parseInt(raw);
            return String.format("%02d:%02d:%02d", totalSec / 3600, (totalSec % 3600) / 60, totalSec % 60);
        }
        String[] parts = raw.split(":");
        List<String> list = new ArrayList<>(Arrays.asList(parts));
        while (list.size() < 3) list.add(0, "00");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.size(); i++) {
            String p = list.get(i).length() < 2 ? "0" + list.get(i) : list.get(i);
            sb.append(p).append(i == 2 ? "" : ":");
        }
        return sb.toString();
    }

    private List<Chapter> parseChapters(String html) {
        List<Chapter> chapters = new ArrayList<>();
        if (html == null) return chapters;

        // 1. 基本清理 HTML
        String cleanText = html.replaceAll("<br\\s*/?>", "\n")
                .replaceAll("<[^>]*>", " ")
                .replaceAll("&nbsp;", " ");

        // 2. 智慧過濾：嘗試多種錨點
        String sponsorLink = "www.zeczec.com/projects/hitomlb";
        String topicAnchor = "本集討論";

        int sponsorIndex = cleanText.indexOf(sponsorLink);
        int topicIndex = cleanText.indexOf(topicAnchor);

        // 優先從贊助連結後開始解析；若無贊助則看是否有「本集討論」；皆無則從頭開始
        int startIndex = 0;
        if (sponsorIndex != -1) {
            startIndex = sponsorIndex + sponsorLink.length();
        } else if (topicIndex != -1) {
            startIndex = topicIndex;
        }

        String targetText = cleanText.substring(startIndex);

        // 3. 使用正則表達式尋找時間戳
        Pattern timePattern = Pattern.compile("\\(((\\d{1,2}:)?\\d{1,2}:\\d{2})\\)");
        Matcher m = timePattern.matcher(targetText);

        int lastMatchPos = 0;
        while (m.find()) {
            String timestamp = m.group(1);

            // 擷取標題
            String rawTitle = targetText.substring(lastMatchPos, m.start());

            // 清理標題文字
            String title = rawTitle.replace("\n", " ").trim();

            // 再次檢查並移除「本集討論」前綴
            if (title.contains(topicAnchor)) {
                title = title.substring(title.indexOf(topicAnchor) + topicAnchor.length()).trim();
            }

            // 移除開頭所有標點符號與空白
            title = title.replaceAll("^[，。、；;：:：\\s]+", "").trim();

            if (title.length() > 1 && !title.startsWith("http")) {
                chapters.add(new Chapter(title, timestamp, timeToSeconds(timestamp)));
            }

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