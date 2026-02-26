package keelung.nomar.hitomlbpodcast.entity;

import java.util.List;

public class Episode {
    private String title, pubDate, audioUrl, fullDescription, link, duration; // 新增 link 與 duration
    private List<Chapter> chapters;

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String t) {
        title = t;
    }

    public String getPubDate() {
        return pubDate;
    }

    public void setPubDate(String d) {
        pubDate = d;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String u) {
        audioUrl = u;
    }

    public String getFullDescription() {
        return fullDescription;
    }

    public void setFullDescription(String s) {
        fullDescription = s;
    }

    public List<Chapter> getChapters() {
        return chapters;
    }

    public void setChapters(List<Chapter> l) {
        chapters = l;
    }
}