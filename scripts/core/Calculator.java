/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package calculator;

/**
 *
 * @author Administrator
 */
public class Calculator {
    int a;
    int b;
    
    public Calculator(int a, int b) {
        this.a = a;
        this.b = b;
    }
    
    public String congHaiSo() {
        return a + b + "";
    }
    
    public String truHaiSo() {
        return a - b + "";
    }
    
    public String nhanHaiSo() {
        return a * b + "";
    }
    
    public String chiaHaiSo() {
        if (b == 0)
            return "Khong the chia vi b = 0";
        else 
            return 1.0 * a / b + "";
    }
    
    public String tinhUSCLN() {
        
        for (int i = 0; i < a; i++) {
           
        }
        
        return "";
    }
    
    public String tinhBSCNN() {
        // for (int )
        return "";
    }
    
    public boolean coPhaiSNT(int number) {
        for (int i = 2; i < Math.sqrt(number); i++) {
            if (number % i == 0) {
                return false;
            }
        }
        
        return true;
    }
    
    public String kiemTraSNT() {
        if (coPhaiSNT(a) == true && coPhaiSNT(b) == true)
            return "a va b la 2 so nguyen to";
        else if (coPhaiSNT(a) == true && coPhaiSNT(b) == false)
            return "a la so nguyen to, b khong phai so nguyen to";
        else if (coPhaiSNT(a) == false && coPhaiSNT(b) == true)
            return "a khong phai so nguyen to, b la so nguyen to";
        else
            return "a va b khong phai so nguyen to";
    }
    

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {
       Calculator cal = new Calculator(3, 2);
       String kq = cal.chiaHaiSo();
       System.out.println("ket qua chia hai so: " + kq);
    }
    
}